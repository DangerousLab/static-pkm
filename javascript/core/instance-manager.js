/**
 * Instance Manager (Phase 0: Single Instance)
 * 
 * Future-proof: Designed to be extended for multi-instance (Phase 1)
 * and transclusion (Phase 2) without breaking changes.
 */

import { messageTunnel } from './message-tunnel.js';

class InstanceManager {
  constructor() {
    this.instances = new Map();
    this.compartments = new Map(); // Track SES compartments
    this.metadata = new Map();
    this.hierarchy = new Map();
  }
  
  /**
   * Register a new instance
   */
  register(instanceId, instance, metadata = {}) {
    this.instances.set(instanceId, instance);
    this.metadata.set(instanceId, {
      moduleId: metadata.moduleId || null,
      parentId: metadata.parentId || null,
      cardId: metadata.cardId || 'card1',
      rootElement: metadata.rootElement || null,
      createdAt: Date.now()
    });
    
    if (metadata.parentId) {
      if (!this.hierarchy.has(metadata.parentId)) {
        this.hierarchy.set(metadata.parentId, []);
      }
      this.hierarchy.get(metadata.parentId).push(instanceId);
    }
    
    console.log('[InstanceManager] Registered:', instanceId);
  }
  
  /**
   * Get an instance by ID
   */
  get(instanceId) {
    return this.instances.get(instanceId) || null;
  }
  
  /**
   * Destroy instance and all its children
   */
  destroy(instanceId) {
    const instanceData = this.instances.get(instanceId);
    
    if (!instanceData) {
      console.warn(`[InstanceManager] Instance not found: ${instanceId}`);
      return;
    }

    // Get all descendants
    const descendants = this._getDescendants(instanceId);
    
    // Destroy in reverse order (children before parents)
    const allToDestroy = [...descendants, instanceId].reverse();
    
    allToDestroy.forEach(id => {
      const data = this.instances.get(id);
      if (data && data.instance && typeof data.instance.destroy === 'function') {
        try {
          data.instance.destroy();
          console.log(`[InstanceManager] Destroyed instance: ${id}`);
        } catch (error) {
          console.error(`[InstanceManager] Error destroying ${id}:`, error);
        }
      }
      
      // Cleanup compartment
      this.destroyCompartment(id);
      
      // Cleanup message tunnel subscriptions
      messageTunnel.unsubscribe(id);
      
      this.instances.delete(id);
    });
    
    console.log(`[InstanceManager] Destroyed: ${instanceId}`);
  }
  
  /**
   * Get all descendant instance IDs (recursive)
   */
  _getDescendants(instanceId) {
    const descendants = [];
    const children = this.hierarchy.get(instanceId) || [];
    
    children.forEach(childId => {
      descendants.push(childId);
      descendants.push(...this._getDescendants(childId));
    });
    
    return descendants;
  }
  
    /**
   * Generate unique instance ID
   * Phase 0: card1:moduleId
   * Phase 1+: card2:moduleId, card1:parent/child
   */
  generateInstanceId(moduleId, parentInstanceId = null, cardId = 'card1') {
    if (!parentInstanceId) {
      return `${cardId}:${moduleId}`;
    }
    
    const basePath = `${parentInstanceId}/${moduleId}`;
    let index = 0;
    let candidateId = basePath;
    
    while (this.instances.has(candidateId)) {
      candidateId = `${basePath}#${index}`;
      index++;
    }
    
    return candidateId;
  }

  /**
   * Register SES compartment for an instance
   */
  registerCompartment(instanceId, compartment) {
    this.compartments.set(instanceId, compartment);
    console.log(`[InstanceManager] Registered compartment for: ${instanceId}`);
  }

  /**
   * Get compartment for an instance
   */
  getCompartment(instanceId) {
    return this.compartments.get(instanceId);
  }

  /**
   * Destroy compartment (called during instance cleanup)
   */
  destroyCompartment(instanceId) {
    const compartment = this.compartments.get(instanceId);
    if (compartment) {
      // SES compartments don't have explicit destroy, just remove reference
      this.compartments.delete(instanceId);
      console.log(`[InstanceManager] Destroyed compartment: ${instanceId}`);
    }
  }

  /**
   * Route message between instances
   */
  routeMessage(fromInstanceId, toInstanceId, message) {
    messageTunnel.send(fromInstanceId, toInstanceId, message);
  }

  /**
   * Get instance by ID (for message delivery)
   */
  getInstanceById(instanceId) {
    return this.instances.get(instanceId);
  }

  /**
   * Clear all instances
   */
  clear() {
    this.instances.forEach((data, id) => {
      if (data.instance && typeof data.instance.destroy === 'function') {
        try {
          data.instance.destroy();
        } catch (error) {
          console.error(`[InstanceManager] Error destroying ${id}:`, error);
        }
      }
      
      // Cleanup compartment
      this.destroyCompartment(id);
      
      // Cleanup message tunnel
      messageTunnel.unsubscribe(id);
    });
    
    this.instances.clear();
    this.compartments.clear();
    console.log('[InstanceManager] All instances and compartments cleared');
  }
}

export const instanceManager = new InstanceManager();
