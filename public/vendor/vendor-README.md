# Vendor Directory Guidelines

**Last Updated:** 2026-02-05  
**Version:** 2.0

---

## Purpose

This directory contains **customized or optimized third-party libraries** that require self-hosting for performance or functionality reasons.

⚠️ **Important:** Most third-party libraries should load from CDN, not be self-hosted. Only add libraries here when customization is required.

---

## When to Self-Host (Use `/vendor`)

Self-host third-party libraries **only when**:

✅ **Customization needed**
   - Modified library code
   - Optimized subsets (e.g., 20 icons from 10,000)
   - Reduced file size through custom builds

✅ **Performance benefits**
   - Customized file is significantly smaller than full library
   - Small optimized files (<100KB) load faster than CDN
   - Example: 600KB full library → 20KB custom subset

✅ **Stability requirements**
   - Need to lock specific features/versions
   - Prevent unexpected changes from CDN updates

---

## When to Use CDN (NOT `/vendor`)

Use CDN for standard libraries **when**:

✅ **Standard library without modifications**
   - No customization needed
   - Using library as-is from npm/CDN

✅ **Performance priority**
   - CDN TTFB (~70ms) is faster than GitHub Pages (~500ms)
   - Large libraries (>500KB) load faster from optimized CDNs

✅ **Easy updates**
   - Change version in one line of code
   - No vendor files to maintain

**Examples:** MathJax, Chart.js, Highlight.js, full FontAwesome

---

## Directory Structure

```
vendor/
├── README.md              # This file
└── [library-name]/        # One directory per customized library
    ├── [library-files]    # Optimized/modified library files
    └── README.md          # Documentation for this specific library
```

### Library-Specific README Template

Each library in `/vendor` should include its own `README.md`:

```markdown
# [Library Name]

**Version:** x.x.x  
**Last Updated:** YYYY-MM-DD

## Why Self-Hosted

[Explain why this library is self-hosted instead of using CDN]
- Customization: [what was modified/optimized]
- Size: Original XXX KB → Optimized XX KB

## Contents

- `file1.js` - [description]
- `file2.css` - [description]

## Usage

[How to use this library in the application]

## Updating

[How to update/rebuild this library when needed]
```

---

## Guidelines

### ✅ DO

- **Document extensively** - Each library needs its own README
- **Keep minimal** - Only include what's actually used
- **Version control** - Note library version in README
- **Optimize first** - Remove unused features/code
- **Test thoroughly** - Ensure customizations work correctly

### ❌ DON'T

- **Don't self-host unnecessarily** - Use CDN when possible
- **Don't modify without documentation** - Always document changes
- **Don't commit unoptimized files** - Build/optimize before committing
- **Don't include full libraries** - Only include what you need
- **Don't mix with user assets** - User files go in `/assets`, not `/vendor`

---

## Maintenance

### Adding a New Vendor Library

1. **Evaluate CDN first**
   - Can this library load from CDN instead?
   - Is customization truly necessary?

2. **Create directory**
   ```bash
   mkdir -p vendor/[library-name]
   ```

3. **Add optimized files**
   - Only include required files
   - Minify/optimize before adding

4. **Document thoroughly**
   - Create library-specific README
   - Explain why self-hosted
   - Document how to update

5. **Update build scripts** (if needed)
   - Add setup scripts to `package.json`
   - Update GitHub Actions workflow

6. **Test**
   - Verify library works correctly
   - Test in production build
   - Check file sizes

### Updating Existing Libraries

1. **Check library README** for update instructions
2. **Follow documented process** (each library may differ)
3. **Test thoroughly** after updates
4. **Update version** in library README
5. **Commit changes** with clear message

### Removing Vendor Libraries

When switching from self-hosted to CDN:

1. **Update code** to load from CDN URL
2. **Remove vendor directory**
   ```bash
   rm -rf vendor/[library-name]
   ```
3. **Update build scripts** (remove setup commands)
4. **Update GitHub Actions** (remove setup steps)
5. **Test thoroughly**
6. **Commit with explanation**

---

## Performance Considerations

### File Size Guidelines

| File Size | Recommendation |
|-----------|----------------|
| < 50 KB | Self-host OK if customized |
| 50-200 KB | Prefer CDN unless heavily optimized |
| 200-500 KB | Use CDN unless significant customization |
| > 500 KB | Always use CDN (unless subset reduces to <100KB) |

### Optimization Checklist

Before committing vendor files:

- [ ] Minified (if JavaScript/CSS)
- [ ] Unused code removed
- [ ] Only required features included
- [ ] Compared size to CDN version
- [ ] Verified performance improvement
- [ ] Documented optimization process

---

## Git Strategy

### What to Commit

✅ **Commit to repository:**
- Customized/optimized vendor packages
- Library-specific README files
- Build scripts for vendor packages

❌ **Do NOT commit:**
- Unmodified full libraries
- Temporary build files
- Source files (only commit built/optimized)

### .gitignore Considerations

By default, `/vendor` should be committed:

```gitignore
# DO NOT add to .gitignore:
# vendor/

# Only ignore if you have specific build artifacts:
vendor/**/src/          # Source files (if you build locally)
vendor/**/*.log         # Build logs
```

---

## Examples of Good Vendor Libraries

### Example 1: FontAwesome Custom Subset
- **Original:** 600 KB (10,000 icons)
- **Optimized:** 20 KB (20 icons)
- **Why:** 97% size reduction through customization
- **Result:** Faster than CDN for small optimized file

### Example 2: Prism.js Language Subset
- **Original:** 150 KB (all languages)
- **Optimized:** 15 KB (3 languages)
- **Why:** Only need syntax highlighting for specific languages
- **Result:** 90% smaller, faster load

### Example 3: Custom Chart Library Theme
- **Original:** CDN version
- **Optimized:** Modified version with custom theme
- **Why:** Extensive customization of default styles
- **Result:** Self-host necessary due to modifications

---

## Decision Tree

```
Need third-party library?
    │
    ├─ Standard library, no changes?
    │   └─ Use CDN ✅
    │
    ├─ Large library (>500KB), no customization?
    │   └─ Use CDN ✅
    │
    ├─ Can reduce size by 50%+ through customization?
    │   └─ Self-host optimized version ✅
    │
    ├─ Need to modify library code?
    │   └─ Self-host modified version ✅
    │
    └─ All other cases?
        └─ Default to CDN ✅
```

---

## Related Documentation

- **BUILD-SYSTEM.md** - Build system and vendor package strategy
- **ARCHITECTURE.md** - Overall application architecture
- **README.md** - Project overview and setup

---

## Questions?

Before adding a vendor library, ask:

1. **Can this load from CDN instead?** (Default: Yes)
2. **Am I customizing/optimizing it?** (If No → use CDN)
3. **Is the optimized version significantly smaller?** (If No → use CDN)
4. **Have I documented why self-hosting?** (Required)
5. **Have I tested performance vs CDN?** (Required)

**When in doubt, use CDN.** Self-hosting should be the exception, not the rule.

---

**Last Updated:** 2026-02-05  
**Version:** 2.0 - Updated to CDN-first strategy
