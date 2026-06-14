const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const User = require('../models/User');
const Notification = require('../models/Notification');

class NotificationService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      logger.info('Email transporter initialized');
    } else {
      logger.warn('Email configuration missing. Email notifications disabled.');
    }
  }

  /**
   * Send email
   */
  async sendEmail(options) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not configured');
        return { success: false, error: 'Email service not configured' };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Attendance System" <noreply@attendance.com>',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      if (options.attachments) {
        mailOptions.attachments = options.attachments;
      }

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent:', { 
        to: options.to, 
        subject: options.subject,
        messageId: info.messageId 
      });
      
      return { success: true, messageId: info.messageId };
      
    } catch (error) {
      logger.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS (placeholder - integrate with SMS provider)
   */
  async sendSMS(options) {
    try {
      // Integrate with Twilio, MSG91, etc.
      logger.info('SMS sent (mock):', { to: options.to, message: options.message });
      return { success: true };
    } catch (error) {
      logger.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification (placeholder)
   */
  async sendPushNotification(options) {
    try {
      // Integrate with Firebase Cloud Messaging, OneSignal, etc.
      logger.info('Push notification sent (mock):', { 
        userId: options.userId, 
        title: options.title 
      });
      return { success: true };
    } catch (error) {
      logger.error('Push notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification (main method)
   */
  async sendNotification(userId, notification) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        logger.warn('User not found for notification:', userId);
        return { success: false, error: 'User not found' };
      }

      const results = {
        email: null,
        sms: null,
        push: null
      };

      // Send email if enabled
      if (user.preferences?.notifications?.email !== false) {
        const emailContent = this.getEmailContent(notification);
        results.email = await this.sendEmail({
          to: user.email,
          subject: notification.title || 'Attendance System Notification',
          html: emailContent
        });
      }

      // Send SMS if enabled
      if (user.preferences?.notifications?.sms === true && notification.urgent) {
        results.sms = await this.sendSMS({
          to: user.phone,
          message: this.getSMSContent(notification)
        });
      }

      // Send push notification if enabled
      if (user.preferences?.notifications?.push !== false) {
        results.push = await this.sendPushNotification({
          userId: user._id,
          title: notification.title,
          body: notification.message,
          data: notification.data
        });
      }

      // Save to database (in-app notification)
      const newNotification = new Notification({
        user_id: user._id,
        title: notification.title || 'Notification',
        message: notification.message || 'You have a new notification.',
        type: notification.type === 'PUNCH_RECORDED' || notification.type === 'REQUEST_APPROVED' ? 'SUCCESS' :
              notification.type === 'REQUEST_REJECTED' || notification.type === 'PERMISSION_REVOKED' ? 'ERROR' :
              notification.urgent ? 'WARNING' : 'INFO',
        notification_type: notification.type || 'SYSTEM_ALERT',
        data: notification.data || {}
      });
      await newNotification.save();
      results.in_app = newNotification._id;

      return { success: true, results };

    } catch (error) {
      logger.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send approval request notification
   */
  async sendApprovalRequest(managerId, data) {
    try {
      const manager = await User.findById(managerId);
      
      if (!manager) {
        logger.warn('Manager not found for approval notification:', managerId);
        return;
      }

      const emailContent = this.getApprovalRequestEmail(data);
      
      await this.sendEmail({
        to: manager.email,
        subject: `[Action Required] Attendance Approval Request - ${data.userName}`,
        html: emailContent
      });

      // Send push notification
      await this.sendPushNotification({
        userId: managerId,
        title: 'Approval Required',
        body: `${data.userName} requires attendance approval for ${data.date}`,
        data: { type: 'approval_request', ...data }
      });

    } catch (error) {
      logger.error('Send approval request error:', error);
    }
  }

  /**
   * Send late notification
   */
  async sendLateNotification(managerIds, data) {
    try {
      if (!Array.isArray(managerIds)) managerIds = [managerIds];
      
      const managers = await User.find({ _id: { $in: managerIds } });
      if (!managers.length) return;

      const emailContent = this.getLateNotificationEmail(data);
      
      for (const manager of managers) {
        if (manager.email) {
          await this.sendEmail({
            to: manager.email,
            subject: `Late Arrival Alert - ${data.userName}`,
            html: emailContent
          });
        }
      }
    } catch (error) {
      logger.error('Send late notification error:', error);
    }
  }

  /**
   * Send early exit notification
   */
  async sendEarlyExitNotification(managerIds, data) {
    try {
      if (!Array.isArray(managerIds)) managerIds = [managerIds];
      
      const managers = await User.find({ _id: { $in: managerIds } });
      if (!managers.length) return;

      const emailContent = this.getEarlyExitNotificationEmail(data);
      
      for (const manager of managers) {
        if (manager.email) {
          await this.sendEmail({
            to: manager.email,
            subject: `Early Exit Alert - ${data.userName}`,
            html: emailContent
          });
        }
      }
    } catch (error) {
      logger.error('Send early exit notification error:', error);
    }
  }

  /**
   * Send location flag notification
   */
  async sendLocationFlagNotification(managerIds, data) {
    try {
      if (!Array.isArray(managerIds)) managerIds = [managerIds];
      
      const managers = await User.find({ _id: { $in: managerIds } });
      if (!managers.length) return;

      const emailContent = this.getLocationFlagNotificationEmail(data);
      
      for (const manager of managers) {
        if (manager.email) {
          await this.sendEmail({
            to: manager.email,
            subject: `Location Flag Alert - ${data.userName}`,
            html: emailContent
          });
        }
      }
    } catch (error) {
      logger.error('Send location flag notification error:', error);
    }
  }

  /**
   * Send missed punch reminder
   */
  async sendMissedPunchReminder(userId, date) {
    try {
      const user = await User.findById(userId);
      
      if (!user) return;

      const emailContent = this.getMissedPunchEmail(user.full_name, date);
      
      await this.sendEmail({
        to: user.email,
        subject: 'Missed Punch Reminder',
        html: emailContent
      });

    } catch (error) {
      logger.error('Send missed punch reminder error:', error);
    }
  }

  /**
   * Send weekly summary
   */
  async sendWeeklySummary(userId, summary) {
    try {
      const user = await User.findById(userId);
      
      if (!user || user.preferences?.notifications?.email === false) return;

      const emailContent = this.getWeeklySummaryEmail(user.full_name, summary);
      
      await this.sendEmail({
        to: user.email,
        subject: 'Weekly Attendance Summary',
        html: emailContent
      });

    } catch (error) {
      logger.error('Send weekly summary error:', error);
    }
  }

  /**
   * Get email content based on notification type
   */
  getEmailContent(notification) {
    switch (notification.type) {
      case 'PUNCH_RECORDED':
        return this.getPunchRecordedEmail(notification);
      case 'REQUEST_APPROVED':
        return this.getRequestApprovedEmail(notification);
      case 'REQUEST_REJECTED':
        return this.getRequestRejectedEmail(notification);
      case 'ATTENDANCE_OVERRIDDEN':
        return this.getAttendanceOverriddenEmail(notification);
      case 'PERMISSION_REVOKED':
        return this.getPermissionRevokedEmail(notification);
      default:
        return this.getDefaultEmail(notification);
    }
  }

  /**
   * Get punch recorded email
   */
  getPunchRecordedEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Attendance Recorded</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Your ${notification.data.punchType} has been recorded successfully.</p>
            <div class="details">
              <p><strong>Time:</strong> ${new Date(notification.data.timestamp).toLocaleString()}</p>
              <p><strong>Type:</strong> ${notification.data.punchType}</p>
            </div>
            <p>You can view your attendance details in the dashboard.</p>
            <br>
            <p>Best regards,<br>Attendance Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get approval request email
   */
  getApprovalRequestEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
          .button { background: #3b82f6; color: white; padding: 10px 20px; 
                    text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Action Required: Attendance Approval</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${data.userName}</strong> requires your approval for attendance on <strong>${data.date}</strong>.</p>
            <p><strong>Reason:</strong> ${data.reason || 'N/A'}</p>
            <p>Please review and take action in the dashboard.</p>
            <a href="${process.env.FRONTEND_URL}/approvals/${data.attendanceId}" class="button">Review Request</a>
            <br><br>
            <p>Best regards,<br>Attendance Management System</p>
          </div>
        </div>
      </html>
    `;
  }

  /**
   * Get late notification email
   */
  getLateNotificationEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .warning { color: #d97706; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Late Arrival Alert</h2>
          <p><strong>${data.userName}</strong> arrived late today.</p>
          <p><strong>Punch In Time:</strong> ${new Date(data.punchTime).toLocaleString()}</p>
          <p><strong>Late by:</strong> ${data.lateBy} minutes</p>
          <p>Please follow up as needed.</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get early exit notification email
   */
  getEarlyExitNotificationEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .warning { color: #d97706; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Early Exit Alert</h2>
          <p><strong>${data.userName}</strong> punched out early today.</p>
          <p><strong>Punch Out Time:</strong> ${new Date(data.punchTime).toLocaleString()}</p>
          <p><strong>Early by:</strong> ${data.earlyBy} minutes</p>
          <p>Please follow up as needed.</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get location flag notification email
   */
  getLocationFlagNotificationEmail(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .warning { color: #d97706; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Location Flag Alert</h2>
          <p><strong>${data.userName}</strong> punched ${data.punchType} from an unauthorized location.</p>
          <p><strong>Time:</strong> ${new Date(data.punchTime).toLocaleString()}</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
          <p>Please review their attendance log for more details.</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get missed punch email
   */
  getMissedPunchEmail(name, date) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .reminder { background: #fef3c7; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Missed Punch Reminder</h2>
          <p>Hello ${name},</p>
          <div class="reminder">
            <p>You have not recorded your attendance for <strong>${date}</strong>.</p>
            <p>Please regularize your attendance or contact your manager.</p>
          </div>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get weekly summary email
   */
  getWeeklySummaryEmail(name, summary) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .summary-box { background: #e0e7ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .stat { display: inline-block; margin: 10px 20px 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Weekly Attendance Summary</h2>
          <p>Hello ${name},</p>
          <p>Here's your attendance summary for this week:</p>
          <div class="summary-box">
            <div class="stat"><strong>Days Present:</strong> ${summary.present_days}</div>
            <div class="stat"><strong>Days Absent:</strong> ${summary.absent_days}</div>
            <div class="stat"><strong>Late Days:</strong> ${summary.late_days}</div>
            <div class="stat"><strong>Total Hours:</strong> ${summary.total_work_hours}</div>
          </div>
          <p>Keep up the good work!</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get SMS content
   */
  getSMSContent(notification) {
    if (notification.message) {
      return notification.message;
    }
    
    switch (notification.type) {
      case 'PUNCH_RECORDED':
        return `Your ${notification.data.punchType} has been recorded at ${new Date(notification.data.timestamp).toLocaleTimeString()}`;
      case 'REQUEST_APPROVED':
        return `Your regularization request has been approved.`;
      case 'REQUEST_REJECTED':
        return `Your regularization request has been rejected. Reason: ${notification.data.reason}`;
      default:
        return notification.title || 'Attendance System Notification';
    }
  }

  /**
   * Get default email
   */
  getDefaultEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <h2>${notification.title || 'Notification'}</h2>
        <p>${notification.message || 'You have a new notification from Attendance Management System.'}</p>
        ${notification.data ? `<pre>${JSON.stringify(notification.data, null, 2)}</pre>` : ''}
        <br>
        <p>Best regards,<br>Attendance Management System</p>
      </body>
      </html>
    `;
  }

  /**
   * Get request approved email
   */
  getRequestApprovedEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { color: #059669; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="success">Request Approved</h2>
          <p>Hello,</p>
          <p>Your regularization request for <strong>${notification.data.date}</strong> has been approved.</p>
          <p>Approved by: ${notification.data.approvedBy}</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get request rejected email
   */
  getRequestRejectedEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .error { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2 class="error">Request Rejected</h2>
          <p>Hello,</p>
          <p>Your regularization request for <strong>${notification.data.date}</strong> has been rejected.</p>
          <p><strong>Reason:</strong> ${notification.data.reason}</p>
          <p>Rejected by: ${notification.data.rejectedBy}</p>
          <br>
          <p>Please contact your manager for more information.</p>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get attendance overridden email
   */
  getAttendanceOverriddenEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Attendance Record Updated</h2>
          <p>Hello,</p>
          <p>Your attendance record for <strong>${notification.data.date}</strong> has been updated by an administrator.</p>
          <p><strong>Reason:</strong> ${notification.data.reason}</p>
          <p>Please review your attendance log for the updated timings.</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get permission revoked email
   */
  getPermissionRevokedEmail(notification) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .warning { background: #fee2e2; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Permissions Revoked</h2>
          <div class="warning">
            <p>Hello,</p>
            <p>The following permissions have been revoked from your account:</p>
            <ul>
              ${notification.data.capabilities?.map(cap => `<li>${cap}</li>`).join('') || '<li>N/A</li>'}
            </ul>
            <p><strong>Reason:</strong> ${notification.data.reason}</p>
            ${notification.data.expiresAt ? `<p><strong>Expires:</strong> ${new Date(notification.data.expiresAt).toLocaleString()}</p>` : ''}
          </div>
          <p>Please contact your administrator if you have any questions.</p>
          <br>
          <p>Best regards,<br>Attendance Management System</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new NotificationService();