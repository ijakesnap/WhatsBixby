const logger = require('./logger');

class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.commandLimits = new Map();
        this.resetInterval = 60000; // 1 minute
        this.maxCommandsPerMinute = 10;
        
        // Clean up expired entries every minute
        setInterval(() => {
            this.cleanup();
        }, this.resetInterval);
    }

    async checkCommandLimit(userId) {
        const now = Date.now();
        const userKey = `${userId}:commands`;
        
        if (!this.userLimits.has(userKey)) {
            this.userLimits.set(userKey, {
                count: 1,
                resetTime: now + this.resetInterval
            });
            return true;
        }

        const userLimit = this.userLimits.get(userKey);
        
        if (now > userLimit.resetTime) {
            // Reset the limit
            userLimit.count = 1;
            userLimit.resetTime = now + this.resetInterval;
            return true;
        }

        if (userLimit.count >= this.maxCommandsPerMinute) {
            return false;
        }

        userLimit.count++;
        return true;
    }

    async getRemainingTime(userId) {
        const userKey = `${userId}:commands`;
        const userLimit = this.userLimits.get(userKey);
        
        if (!userLimit) return 0;
        
        const now = Date.now();
        return Math.max(0, userLimit.resetTime - now);
    }

    cleanup() {
        const now = Date.now();
        for (const [key, limit] of this.userLimits.entries()) {
            if (now > limit.resetTime) {
                this.userLimits.delete(key);
            }
        }
    }
}

module.exports = new RateLimiter();