/**
 * Migration: 002_add_photo_capture_fields
 * Description: Add photo capture configuration fields
 * Date: 2024-02-01
 */

module.exports = {
  async up(db) {
    console.log('Running migration: 002_add_photo_capture_fields - UP');
    
    // Add photo capture fields to attendance logs
    await db.collection('attendance_logs').updateMany(
      {},
      {
        $set: {
          'punch_in.selfie_url': null,
          'punch_out.selfie_url': null
        }
      }
    );
    
    // Add photo capture preferences to users
    await db.collection('users').updateMany(
      {},
      {
        $set: {
          'preferences.photo_capture_enabled': true
        }
      }
    );
    
    // Add photo requirement to policies
    await db.collection('policies').updateMany(
      {},
      {
        $set: {
          'rules.attendance.require_photo_on_failure': false,
          'rules.attendance.photo_retention_days': 90
        }
      }
    );
    
    console.log('Migration 002_add_photo_capture_fields completed successfully');
  },

  async down(db) {
    console.log('Running migration: 002_add_photo_capture_fields - DOWN');
    
    // Remove photo capture fields
    await db.collection('attendance_logs').updateMany(
      {},
      {
        $unset: {
          'punch_in.selfie_url': '',
          'punch_out.selfie_url': ''
        }
      }
    );
    
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          'preferences.photo_capture_enabled': ''
        }
      }
    );
    
    await db.collection('policies').updateMany(
      {},
      {
        $unset: {
          'rules.attendance.require_photo_on_failure': '',
          'rules.attendance.photo_retention_days': ''
        }
      }
    );
    
    console.log('Migration 002_add_photo_capture_fields rolled back successfully');
  }
};