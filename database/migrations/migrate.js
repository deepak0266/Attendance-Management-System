#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

// Migration configuration
const config = {
  mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system',
  migrationsCollection: 'migrations'
};

// Available migrations
const migrations = [
  { name: '001_initial_schema', file: '001_initial_schema.js' },
  { name: '002_add_photo_capture_fields', file: '002_add_photo_capture_fields.js' }
];

async function ensureMigrationsCollection(db) {
  const collections = await db.listCollections({ name: config.migrationsCollection }).toArray();
  
  if (collections.length === 0) {
    await db.createCollection(config.migrationsCollection);
    console.log(`✅ Created ${config.migrationsCollection} collection`);
  }
}

async function getAppliedMigrations(db) {
  const collection = db.collection(config.migrationsCollection);
  const applied = await collection.find({}).sort({ appliedAt: 1 }).toArray();
  return applied.map(m => m.name);
}

async function recordMigration(db, migrationName, direction) {
  const collection = db.collection(config.migrationsCollection);
  
  if (direction === 'up') {
    await collection.insertOne({
      name: migrationName,
      appliedAt: new Date()
    });
  } else {
    await collection.deleteOne({ name: migrationName });
  }
}

async function runMigration(db, migration, direction = 'up') {
  const migrationModule = require(`./${migration.file}`);
  
  console.log(`\n📦 Running migration: ${migration.name} - ${direction.toUpperCase()}`);
  
  try {
    if (direction === 'up') {
      await migrationModule.up(db);
      await recordMigration(db, migration.name, 'up');
    } else {
      await migrationModule.down(db);
      await recordMigration(db, migration.name, 'down');
    }
    
    console.log(`✅ Migration ${migration.name} - ${direction} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${migration.name} failed:`, error);
    return false;
  }
}

async function migrate(direction = 'up', target = null) {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                                                      ║');
  console.log('║   Attendance Management System - Migration Tool      ║');
  console.log('║                                                      ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  let connection;
  
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    connection = await mongoose.connect(config.mongoURI);
    const db = connection.connection.db;
    console.log('✅ Connected to MongoDB\n');
    
    // Ensure migrations collection exists
    await ensureMigrationsCollection(db);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(db);
    console.log(`📋 Applied migrations: ${appliedMigrations.length > 0 ? appliedMigrations.join(', ') : 'None'}`);
    
    let migrationsToRun = [];
    
    if (direction === 'up') {
      // Filter out already applied migrations
      migrationsToRun = migrations.filter(m => !appliedMigrations.includes(m.name));
      
      if (target) {
        migrationsToRun = migrationsToRun.filter(m => m.name <= target);
      }
      
      if (migrationsToRun.length === 0) {
        console.log('\n✅ All migrations are already applied.');
        return;
      }
      
      console.log(`\n📦 Migrations to apply: ${migrationsToRun.map(m => m.name).join(', ')}`);
      
      for (const migration of migrationsToRun) {
        const success = await runMigration(db, migration, 'up');
        if (!success) {
          console.error('\n❌ Migration failed. Stopping.');
          process.exit(1);
        }
      }
      
    } else if (direction === 'down') {
      // Get migrations to rollback
      let migrationsToRollback = migrations.filter(m => appliedMigrations.includes(m.name)).reverse();
      
      if (target) {
        const targetIndex = migrationsToRollback.findIndex(m => m.name === target);
        if (targetIndex >= 0) {
          migrationsToRollback = migrationsToRollback.slice(0, targetIndex + 1);
        }
      } else {
        // Rollback only the last migration by default
        migrationsToRollback = migrationsToRollback.slice(0, 1);
      }
      
      if (migrationsToRollback.length === 0) {
        console.log('\n✅ No migrations to rollback.');
        return;
      }
      
      console.log(`\n📦 Migrations to rollback: ${migrationsToRollback.map(m => m.name).join(', ')}`);
      
      for (const migration of migrationsToRollback) {
        const success = await runMigration(db, migration, 'down');
        if (!success) {
          console.error('\n❌ Rollback failed. Stopping.');
          process.exit(1);
        }
      }
    }
    
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                                                      ║');
    console.log('║   ✅ Migration completed successfully!               ║');
    console.log('║                                                      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.disconnect();
      console.log('🔌 MongoDB connection closed\n');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const direction = args[0] || 'up';
const target = args[1] || null;

if (!['up', 'down'].includes(direction)) {
  console.error('Usage: node migrate.js [up|down] [target_migration]');
  console.error('  up              - Apply all pending migrations');
  console.error('  down            - Rollback the last migration');
  console.error('  down [name]     - Rollback to specific migration');
  process.exit(1);
}

// Run migrations
migrate(direction, target);