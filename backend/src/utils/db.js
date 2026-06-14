const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Database utility functions
 */
class DatabaseUtils {
  /**
   * Create a transaction session
   */
  async withTransaction(callback) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Bulk insert with chunking
   */
  async bulkInsert(model, documents, chunkSize = 1000) {
    const results = {
      inserted: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < documents.length; i += chunkSize) {
      const chunk = documents.slice(i, i + chunkSize);
      
      try {
        await model.insertMany(chunk, { ordered: false });
        results.inserted += chunk.length;
      } catch (error) {
        if (error.writeErrors) {
          results.inserted += error.insertedDocs?.length || 0;
          results.failed += error.writeErrors.length;
          results.errors.push(...error.writeErrors);
        } else {
          results.failed += chunk.length;
          results.errors.push(error);
        }
      }
    }
    
    return results;
  }

  /**
   * Bulk update with chunking
   */
  async bulkUpdate(model, operations, chunkSize = 1000) {
    const results = {
      modified: 0,
      failed: 0
    };
    
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      
      try {
        const bulkOps = model.collection.initializeUnorderedBulkOp();
        
        chunk.forEach(op => {
          if (op.updateOne) {
            bulkOps.find(op.updateOne.filter).updateOne(op.updateOne.update);
          } else if (op.updateMany) {
            bulkOps.find(op.updateMany.filter).update(op.updateMany.update);
          }
        });
        
        const result = await bulkOps.execute();
        results.modified += result.nModified || 0;
      } catch (error) {
        logger.error('Bulk update error:', error);
        results.failed += chunk.length;
      }
    }
    
    return results;
  }

  /**
   * Paginate query results
   */
  async paginate(model, query = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { created_at: -1 },
      select,
      populate
    } = options;
    
    const skip = (page - 1) * limit;
    
    let queryBuilder = model.find(query);
    
    if (select) {
      queryBuilder = queryBuilder.select(select);
    }
    
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(p => {
          queryBuilder = queryBuilder.populate(p);
        });
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }
    
    const [data, total] = await Promise.all([
      queryBuilder.sort(sort).skip(skip).limit(limit).lean(),
      model.countDocuments(query)
    ]);
    
    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Aggregate pagination
   */
  async aggregatePaginate(model, pipeline = [], options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;
    
    const skip = (page - 1) * limit;
    
    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    
    const [countResult, data] = await Promise.all([
      model.aggregate(countPipeline),
      model.aggregate(dataPipeline)
    ]);
    
    const total = countResult[0]?.total || 0;
    
    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Check if document exists
   */
  async exists(model, query) {
    const count = await model.countDocuments(query).limit(1);
    return count > 0;
  }

  /**
   * Find or create document
   */
  async findOrCreate(model, query, data) {
    let document = await model.findOne(query);
    
    if (!document) {
      document = await model.create({ ...query, ...data });
    }
    
    return document;
  }

  /**
   * Update or create document
   */
  async upsert(model, query, data) {
    return model.findOneAndUpdate(
      query,
      { $set: data },
      { upsert: true, new: true, runValidators: true }
    );
  }

  /**
   * Soft delete document
   */
  async softDelete(model, id, deletedBy = null) {
    return model.findByIdAndUpdate(
      id,
      {
        deleted_at: new Date(),
        deleted_by: deletedBy,
        is_deleted: true
      },
      { new: true }
    );
  }

  /**
   * Restore soft deleted document
   */
  async restore(model, id) {
    return model.findByIdAndUpdate(
      id,
      {
        deleted_at: null,
        deleted_by: null,
        is_deleted: false
      },
      { new: true }
    );
  }

  /**
   * Get database stats
   */
  async getDatabaseStats() {
    const stats = {
      collections: {},
      totalSize: 0
    };
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      const collStats = await mongoose.connection.db
        .collection(collection.name)
        .stats();
      
      stats.collections[collection.name] = {
        count: collStats.count,
        size: collStats.size,
        avgObjSize: collStats.avgObjSize,
        indexes: collStats.nindexes
      };
      
      stats.totalSize += collStats.size;
    }
    
    return stats;
  }

  /**
   * Create indexes for all models
   */
  async ensureIndexes() {
    const models = mongoose.models;
    
    for (const [name, model] of Object.entries(models)) {
      try {
        await model.createIndexes();
        logger.info(`Indexes created for ${name}`);
      } catch (error) {
        logger.error(`Failed to create indexes for ${name}:`, error);
      }
    }
  }

  /**
   * Drop indexes for a model
   */
  async dropIndexes(model) {
    try {
      await model.collection.dropIndexes();
      logger.info(`Indexes dropped for ${model.modelName}`);
    } catch (error) {
      logger.error(`Failed to drop indexes for ${model.modelName}:`, error);
      throw error;
    }
  }

  /**
   * Get index information
   */
  async getIndexes(model) {
    return model.collection.indexes();
  }

  /**
   * Create text search index
   */
  async createTextIndex(model, fields, weights = {}) {
    const indexFields = {};
    
    fields.forEach(field => {
      indexFields[field] = 'text';
    });
    
    const options = {};
    if (Object.keys(weights).length > 0) {
      options.weights = weights;
    }
    
    return model.collection.createIndex(indexFields, options);
  }

  /**
   * Geospatial query helper
   */
  async findNear(model, coordinates, maxDistance, query = {}) {
    const [lng, lat] = coordinates;
    
    return model.find({
      ...query,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: maxDistance
        }
      }
    });
  }

  /**
   * Date range query helper
   */
  buildDateRangeQuery(startDate, endDate, field = 'created_at') {
    const query = {};
    
    if (startDate && endDate) {
      query[field] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query[field] = { $gte: new Date(startDate) };
    } else if (endDate) {
      query[field] = { $lte: new Date(endDate) };
    }
    
    return query;
  }

  /**
   * Clean expired documents
   */
  async cleanExpired(model, expireField = 'expire_at') {
    const result = await model.deleteMany({
      [expireField]: { $lt: new Date() }
    });
    
    logger.info(`Cleaned ${result.deletedCount} expired documents from ${model.modelName}`);
    return result;
  }

  /**
   * Archive old documents
   */
  async archiveOldDocuments(sourceModel, archiveModel, cutoffDate, query = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const filter = {
        ...query,
        created_at: { $lt: cutoffDate }
      };
      
      const documents = await sourceModel.find(filter).lean();
      
      if (documents.length > 0) {
        await archiveModel.insertMany(documents, { session });
        await sourceModel.deleteMany(filter, { session });
      }
      
      await session.commitTransaction();
      
      logger.info(`Archived ${documents.length} documents from ${sourceModel.modelName}`);
      return documents.length;
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Archive error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new DatabaseUtils();