# Implementation Roadmap

## Executive Summary

**Timeline:** 6 weeks to 10-50x performance gain
**Effort:** Medium-High (Rust learning curve)
**ROI:** Professional-grade spreadsheet viewer
**Risk:** Low (incremental approach)

---

## Decision Tree

### Decision 1: Rendering Approach

**Option A: DOM + Virtual Viewport**
- Effort: 1 week
- Speedup: 2-3x
- Max: 100k rows smooth
- Best for: Quick wins

**Option B: Canvas + Virtual Viewport (RECOMMENDED)**
- Effort: 2 weeks
- Speedup: 10-20x
- Max: 1M+ rows smooth
- Best for: Professional tool

**Option C: WebGL (Quadratic-style)**
- Effort: 4 weeks
- Speedup: 50-100x
- Max: Unlimited
- Best for: Product differentiator

**Recommendation:** Option B

### Decision 2: Backend Language

**Option A: Keep TypeScript**
- Speedup: 1x (no change)
- Not recommended

**Option B: Rust WASM (RECOMMENDED)**
- Speedup: 5-10x computation
- Effort: 3 weeks
- Best for: Speed + offline

**Option C: Rust Server-Side**
- Speedup: 5-10x computation
- Effort: 4 weeks
- Best for: Server deployments

**Recommendation:** Option B

### Decision 3: Data Processing

**Option A: Polars (RECOMMENDED)**
- Speedup: 5-10x
- Effort: 1 week
- Best for: Tables, aggregations

**Option B: Manual Rust**
- Speedup: 3-5x
- Effort: 2-3 weeks
- Best for: Learning

**Option C: Optimized JavaScript**
- Speedup: 2x
- Inadequate

**Recommendation:** Option A

---

## Week-by-Week Plan

### Week 1: Foundation

**Goal:** Prove Rust WASM works

**Tasks:**
1. Create Rust project: `cargo new --lib excel_engine`
2. Add Calamine dependency
3. Implement Excel parser
4. Generate TypeScript bindings: `wasm-pack build`
5. Test in VSCode extension

**Deliverable:**
- Working WASM module
- 2-5x parsing speedup
- Proof of concept

**Success Metrics:**
- ✅ Parse 10MB Excel in <2s (vs 5-10s)
- ✅ WASM ↔ TypeScript boundary works
- ✅ No crashes

### Week 2-3: Formula Engine

**Goal:** 5-10x faster formulas

**Tasks:**
1. Implement SUM, AVERAGE, COUNT, MIN, MAX
2. Add VLOOKUP, INDEX, MATCH
3. Build TypeScript wrapper
4. Test 1000 formulas on 100k rows
5. Benchmark vs current

**Deliverable:**
- Rust formula engine
- 5-10x speedup
- Performance benchmarks

**Success Metrics:**
- ✅ Common functions work
- ✅ 1000 formulas in <100ms
- ✅ Edge cases handled

### Week 3-4: Table Operations

**Goal:** Instant complex queries

**Tasks:**
1. Integrate Polars
2. Implement filter, sort, groupby
3. Add pivot tables
4. Test 100k row operations
5. Benchmark

**Deliverable:**
- Polars integration
- Complex operations
- Performance metrics

**Success Metrics:**
- ✅ Filter 100k rows: <300ms
- ✅ Groupby + aggregate: <500ms
- ✅ Memory efficient

### Week 4-5: Canvas Rendering

**Goal:** 60fps smooth interactions

**Tasks:**
1. Choose Pixi.js
2. Implement virtual viewport
3. Add pan/zoom
4. Replace DOM grid
5. Test with 100k cells

**Deliverable:**
- Canvas-based grid
- Virtual viewport
- Pan/zoom

**Success Metrics:**
- ✅ 100k cells: 60fps
- ✅ Smooth pan/zoom
- ✅ Memory <500MB

### Week 5-6: Optimization & Polish

**Goal:** Production-ready

**Tasks:**
1. Profile with DevTools
2. Optimize bottlenecks
3. Add spatial hashing if needed
4. Implement UX features
5. Test edge cases
6. Write documentation

**Deliverable:**
- Production-ready extension
- Complete documentation
- Performance benchmarks

**Success Metrics:**
- ✅ All operations <500ms
- ✅ No memory leaks
- ✅ Professional UX

---

## Critical Success Factors

### Do's:
✅ Start with parser (quick wins)
✅ Use Polars (battle-tested)
✅ Profile everything (optimize what matters)
✅ Test with real data (user files)
✅ Benchmark each phase (measure progress)

### Don'ts:
❌ Don't rewrite everything at once
❌ Don't skip virtual viewport
❌ Don't manually implement tables
❌ Don't ignore WASM binary size

---

## Expected Outcomes

### Performance Table

| Metric | Current | Week 1 | Week 3 | Week 5 | Target |
|--------|---------|--------|--------|--------|--------|
| Parse 10MB | 5-10s | 1-2s | 500ms | 500ms | ✅ |
| Display 100k | Sluggish | Better | Smooth | 60fps | ✅ |
| Filter 100k | 3-8s | 2-5s | 500ms | 300ms | ✅ |
| Memory | 500MB | 400MB | 200MB | 100MB | ✅ |
| Edit latency | 100ms | 50ms | 20ms | 5ms | ✅ |

### User Experience

- **Week 1:** Faster loading
- **Week 3:** Instant queries
- **Week 5:** Smooth 60fps
- **Week 6:** Professional tool

---

## Decision Checklist

Before starting:
- [ ] Team has Rust experience (or willing to learn)
- [ ] WASM tooling is set up
- [ ] Test Excel files available (small, medium, large)
- [ ] Performance benchmarking tools ready
- [ ] Team agrees on architecture
- [ ] CI/CD supports WASM builds
- [ ] Browser support requirements clear

---

## Immediate Action Plan

**This Week:**
1. Create Rust WASM parser
   - Effort: 1-2 days
   - ROI: 2-5x speedup
   - Risk: Low

**Next Week:**
2. Add formula engine
   - Effort: 3-5 days
   - ROI: 5-10x speedup
   - Risk: Low

**Week 3-4:**
3. Integrate Polars + Canvas
   - Effort: 2 weeks
   - ROI: 50-100x total
   - Risk: Medium

**Week 5-6:**
4. Optimize and polish
   - Effort: 1-2 weeks
   - ROI: Production quality
   - Risk: Low

**Total:** 6 weeks to production-ready

---

## Resources

**Core Technologies:**
- [wasm-pack](https://rustwasm.org/docs/wasm-pack/) - Build WASM
- [Calamine](https://docs.rs/calamine/) - Excel parsing
- [Polars](https://www.pola.rs/) - Data operations
- [Pixi.js](https://pixijs.com/) - Canvas rendering

**Learning:**
- [Rust Book](https://doc.rust-lang.org/book/)
- [WASM Book](https://rustwasm.org/docs/book/)
- [Polars Guide](https://docs.pola.rs/)

**Performance Tools:**
- Chrome DevTools (Profiler, Memory)
- `cargo bench` for Rust
- Lighthouse for WebView

---

**Status:** Ready to implement
**Last Updated:** February 2026
