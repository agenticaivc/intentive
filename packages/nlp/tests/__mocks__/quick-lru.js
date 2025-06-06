// Mock implementation of quick-lru for testing
class MockQuickLRU extends Map {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 100;
    this.maxAge = options.maxAge || Infinity;
  }

  set(key, value) {
    // Simple LRU behavior - remove oldest if at capacity
    if (this.size >= this.maxSize && !this.has(key)) {
      const firstKey = this.keys().next().value;
      this.delete(firstKey);
    }
    
    return super.set(key, value);
  }

  get(key) {
    const value = super.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.delete(key);
      this.set(key, value);
    }
    return value;
  }
}

module.exports = MockQuickLRU;
module.exports.default = MockQuickLRU; 