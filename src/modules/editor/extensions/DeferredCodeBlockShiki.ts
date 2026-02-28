import { CodeBlockShiki } from 'tiptap-extension-code-block-shiki';
import { Plugin } from '@tiptap/pm/state';

/**
 * DeferredCodeBlockShiki
 * 
 * A custom wrapper around the Shiki syntax highlighting extension that pauses
 * the expensive AST parsing layer during rapid scroll events. 
 * 
 * When `window.unstablonScrollState === 'scrolling'`, this plugin intercepts
 * the internal ProseMirror `apply` transaction and simply maps existing 
 * decorations forward, preventing the heavy synchronous WebAssembly parser 
 * from freezing the main thread while the user scrolls.
 * 
 * Once scrolling stops and the view settles, the `shikiPluginForceDecoration` 
 * meta flag is dispatched to paint the final document state.
 */
export const DeferredCodeBlockShiki = CodeBlockShiki.extend({
    addProseMirrorPlugins() {
        // Get the base plugins provided by the original extension
        const plugins = this.parent?.() || [];

        // Find the Shiki syntax highlighting plugin (it registers with key "shiki$1" or similar)
        const shikiPluginIndex = plugins.findIndex(
            (p: any) => p.key && typeof p.key === 'string' && p.key.includes('shiki')
        );

        if (shikiPluginIndex !== -1) {
            const originalPlugin = plugins[shikiPluginIndex] as any;
            const originalApply = originalPlugin?.spec?.state?.apply;

            if (originalApply) {
                // Clone the plugin spec and monkey-patch the apply method
                const newSpec = { ...originalPlugin.spec };

                newSpec.state = {
                    ...originalPlugin.spec.state,
                    // Intercept the state application
                    apply: (tr: any, value: any, oldState: any, newState: any) => {
                        // Check global scroll state. Set by ViewportCoordinator.
                        const isScrolling = (window as any).unstablonScrollState === 'scrolling';

                        // If we are actively scrolling AND this isn't an explicit force-render transaction
                        if (isScrolling && !tr.getMeta('shikiPluginForceDecoration')) {
                            // Defer syntax parsing: simply map the existing decorations
                            // to the new document structure, saving ~40ms of CPU time during scroll.
                            return value.map(tr.mapping, tr.doc);
                        }

                        // Otherwise, run the heavy AST parsing naturally
                        return originalApply(tr, value, oldState, newState);
                    },
                };

                // Replace the plugin in the array
                plugins[shikiPluginIndex] = new Plugin(newSpec);
            }
        }

        return plugins;
    }
});
