/**
 * Instance Manager (Phase 0: Single Instance)
 * 
 * Future-proof: Designed to be extended for multi-instance (Phase 1)
 * and transclusion (Phase 2) without breaking changes.
 */

class InstanceManager {
  constructor() {
    this.instances = new Map();
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
    const toDestroy = this._getDescendants(instanceId);
    toDestroy.push(instanceId);
    
    toDestroy.reverse().forEach(id => {
      const instance = this.instances.get(id);
      if (instance && typeof instance.destroy === 'function') {
        try {
          instance.destroy();
          console.log('[InstanceManager] Destroyed:', id);
        } catch (e) {
          console.error(`[InstanceManager] Failed to destroy ${id}:`, e);
        }
      }
      
      this.instances.delete(id);
      this.metadata.delete(id);
      this.hierarchy.delete(id);
    });
    
    const meta = this.metadata.get(instanceId);
    if (meta && meta.parentId) {
      const siblings = this.hierarchy.get(meta.parentId) || [];
      const filtered = siblings.filter(id => id !== instanceId);
      this.hierarchy.set(meta.parentId, filtered);
    }
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
   * Clear all instances
   */
  clear() {
    const rootInstances = Array.from(this.instances.keys()).filter(id => {
      const meta = this.metadata.get(id);
      return !meta || !meta.parentId;
    });
    
    rootInstances.forEach(id => this.destroy(id));
  }
}

export const instanceManager = new InstanceManager();
