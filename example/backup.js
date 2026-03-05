/**
 * Example Module - User Management System
 * This file demonstrates various functions that can be modified using mkfix
 */

// Configuration
const API_URL = 'http://localhost:3000';
const TIMEOUT = 5000;
const MAX_RETRIES = 3;

/**
 * User class for managing user data
 */
class User {
  constructor(id, name, email, role = 'user') {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
    this.createdAt = new Date();
    this.isActive = true;
  }

  validate() {
    if (!this.name || this.name.length < 2) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }
    if (!this.email || !this.email.includes('@')) {
      return { valid: false, error: 'Invalid email address' };
    }
    return { valid: true };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt.toISOString(),
      isActive: this.isActive
    };
  }
}

/**
 * User Service - Handles user operations
 */
class UserService {
  constructor() {
    this.users = new Map();
    this.nextId = 1;
  }

  async createUser(name, email, role) {
    const user = new User(this.nextId++, name, email, role);
    const validation = user.validate();
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    this.users.set(user.id, user);
    console.log(`User created: ${user.name}`);
    return user;
  }

  async getUser(id) {
    const user = this.users.get(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUser(id, updates) {
    const user = await this.getUser(id);
    Object.assign(user, updates);
    return user;
  }

  async deleteUser(id) {
    const user = await this.getUser(id);
    this.users.delete(id);
    console.log(`User deleted: ${user.name}`);
    return true;
  }

  async listUsers() {
    return Array.from(this.users.values());
  }

  async findByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }
}

/**
 * API Client for making HTTP requests
 */
class APIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: { ...this.headers, ...options.headers }
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

/**
 * Utility functions
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Logger utility
 */
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  warn: (message) => console.warn(`[WARN] ${message}`),
  error: (message) => console.error(`[ERROR] ${message}`),
  debug: (message) => console.log(`[DEBUG] ${message}`)
};

// Export modules
module.exports = {
  User,
  UserService,
  APIClient,
  formatDate,
  generateId,
  debounce,
  logger,
  API_URL,
  TIMEOUT,
  MAX_RETRIES
};
