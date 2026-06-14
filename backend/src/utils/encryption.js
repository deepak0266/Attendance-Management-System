const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

class EncryptionUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = this.deriveKey(process.env.ENCRYPTION_KEY || 'default-key-change-this-in-production');
  }

  /**
   * Derive encryption key from secret
   */
  deriveKey(secret) {
    return crypto.scryptSync(secret, 'salt', 32);
  }

  /**
   * Encrypt data
   */
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(encryptedData.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt object
   */
  encryptObject(obj) {
    const jsonStr = JSON.stringify(obj);
    const encrypted = this.encrypt(jsonStr);
    return encrypted;
  }

  /**
   * Decrypt object
   */
  decryptObject(encryptedData) {
    const jsonStr = this.decrypt(encryptedData);
    return JSON.parse(jsonStr);
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password
   */
  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate random string
   */
  generateRandomString(length = 10) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[randomBytes[i] % charset.length];
    }
    
    return result;
  }

  /**
   * Generate numeric OTP
   */
  generateOTP(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    
    return (min + (randomNumber % (max - min + 1))).toString();
  }

  /**
   * Create hash
   */
  createHash(data, algorithm = 'sha256') {
    return crypto
      .createHash(algorithm)
      .update(data)
      .digest('hex');
  }

  /**
   * Create HMAC
   */
  createHMAC(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data, secret, signature) {
    const expected = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  }

  /**
   * Generate key pair
   */
  generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
  }

  /**
   * Sign data with private key
   */
  sign(data, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Verify signature with public key
   */
  verify(data, signature, publicKey) {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'hex');
  }

  /**
   * Mask sensitive data
   */
  maskEmail(email) {
    if (!email) return '';
    const [username, domain] = email.split('@');
    if (username.length <= 2) return email;
    
    const masked = username.slice(0, 2) + '*'.repeat(username.length - 2);
    return `${masked}@${domain}`;
  }

  /**
   * Mask phone number
   */
  maskPhone(phone) {
    if (!phone) return '';
    if (phone.length <= 4) return phone;
    
    return '*'.repeat(phone.length - 4) + phone.slice(-4);
  }

  /**
   * Mask credit card number
   */
  maskCreditCard(cardNumber) {
    if (!cardNumber) return '';
    const last4 = cardNumber.slice(-4);
    return '*'.repeat(cardNumber.length - 4) + last4;
  }

  /**
   * Sanitize HTML
   */
  sanitizeHtml(html) {
    return html
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    
    return {
      valid: score >= 4,
      score,
      checks
    };
  }

  /**
   * Generate password hash for storage
   */
  hashForStorage(data) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(data, salt, 100000, 64, 'sha512')
      .toString('hex');
    
    return `${salt}:${hash}`;
  }

  /**
   * Verify stored hash
   */
  verifyStoredHash(data, stored) {
    const [salt, originalHash] = stored.split(':');
    const hash = crypto
      .pbkdf2Sync(data, salt, 100000, 64, 'sha512')
      .toString('hex');
    
    return hash === originalHash;
  }
}

module.exports = new EncryptionUtils();