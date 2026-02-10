/**
 * Message Tunnel for Inter-Module Communication
 * Safe, controlled communication between isolated modules
 */

class MessageTunnel {
  constructor() {
    this.subscribers = new Map(); // instanceId -> Set of callbacks
    this.messageLog = []; // For debugging
  }
  
  /**
   * Send message to specific instance
   */
  send(fromInstanceId, toInstanceId, message) {
    console.log(`[Tunnel] ${fromInstanceId} → ${toInstanceId}:`, message);
    
    // Log message
    this.messageLog.push({
      timestamp: Date.now(),
      from: fromInstanceId,
      to: toInstanceId,
      message: message
    });
    
    // Deliver to subscribers
    const callbacks = this.subscribers.get(toInstanceId);
    if (callbacks && callbacks.size > 0) {
      const envelope = {
        from: fromInstanceId,
        to: toInstanceId,
        message: message,
        timestamp: Date.now()
      };
      
      callbacks.forEach(callback => {
        try {
          callback(envelope);
        } catch (error) {
          console.error(`[Tunnel] Error in message handler for ${toInstanceId}:`, error);
        }
      });
    } else {
      console.warn(`[Tunnel] No subscribers for ${toInstanceId}`);
    }
  }
  
  /**
   * Broadcast message to all instances
   */
  broadcast(fromInstanceId, message) {
    console.log(`[Tunnel] Broadcast from ${fromInstanceId}:`, message);
    
    this.subscribers.forEach((callbacks, toInstanceId) => {
      if (toInstanceId !== fromInstanceId) {
        this.send(fromInstanceId, toInstanceId, message);
      }
    });
  }
  
  /**
   * Subscribe to messages for an instance
   */
  subscribe(instanceId, callback) {
    if (!this.subscribers.has(instanceId)) {
      this.subscribers.set(instanceId, new Set());
    }
    
    this.subscribers.get(instanceId).add(callback);
    console.log(`[Tunnel] Subscribed: ${instanceId}`);
  }
  
  /**
   * Unsubscribe all callbacks for an instance
   */
  unsubscribe(instanceId) {
    this.subscribers.delete(instanceId);
    console.log(`[Tunnel] Unsubscribed: ${instanceId}`);
  }
  
  /**
   * Create tunnel API for a specific instance
   */
  createInstanceAPI(instanceId) {
    return {
      send: (toInstanceId, message) => {
        this.send(instanceId, toInstanceId, message);
      },
      
      broadcast: (message) => {
        this.broadcast(instanceId, message);
      },
      
      onMessage: (callback) => {
        this.subscribe(instanceId, callback);
      }
    };
  }
  
  /**
   * Get message log for debugging
   */
  getMessageLog() {
    return [...this.messageLog];
  }
  
  /**
   * Clear message log
   */
  clearMessageLog() {
    this.messageLog = [];
  }
}

// Singleton instance
export const messageTunnel = new MessageTunnel();
