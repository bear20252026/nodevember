(function () {
  "use strict";
  const Y = {};
  function ot(n) {
    const t = n[0];
    if (typeof t == "string" && t.startsWith("TSL:")) {
      const e = n[1];
      e && e.isStackTrace
        ? (n[0] += " " + e.getLocation())
        : (n[1] =
            'Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.');
    }
    return n;
  }
  function J(...n) {
    n = ot(n);
    const t = "THREE." + n.shift();
    {
      const e = n[0];
      e && e.isStackTrace ? console.warn(e.getError(t)) : console.warn(t, ...n);
    }
  }
  function q(...n) {
    const t = n.join(" ");
    t in Y || ((Y[t] = !0), J(...n));
  }
  function I(n, t, e) {
    return Math.max(t, Math.min(e, n));
  }
  const G = class G {
    constructor(t = 0, e = 0) {
      ((this.x = t), (this.y = e));
    }
    get width() {
      return this.x;
    }
    set width(t) {
      this.x = t;
    }
    get height() {
      return this.y;
    }
    set height(t) {
      this.y = t;
    }
    set(t, e) {
      return ((this.x = t), (this.y = e), this);
    }
    setScalar(t) {
      return ((this.x = t), (this.y = t), this);
    }
    setX(t) {
      return ((this.x = t), this);
    }
    setY(t) {
      return ((this.y = t), this);
    }
    setComponent(t, e) {
      switch (t) {
        case 0:
          this.x = e;
          break;
        case 1:
          this.y = e;
          break;
        default:
          throw new Error("THREE.Vector2: index is out of range: " + t);
      }
      return this;
    }
    getComponent(t) {
      switch (t) {
        case 0:
          return this.x;
        case 1:
          return this.y;
        default:
          throw new Error("THREE.Vector2: index is out of range: " + t);
      }
    }
    clone() {
      return new this.constructor(this.x, this.y);
    }
    copy(t) {
      return ((this.x = t.x), (this.y = t.y), this);
    }
    add(t) {
      return ((this.x += t.x), (this.y += t.y), this);
    }
    addScalar(t) {
      return ((this.x += t), (this.y += t), this);
    }
    addVectors(t, e) {
      return ((this.x = t.x + e.x), (this.y = t.y + e.y), this);
    }
    addScaledVector(t, e) {
      return ((this.x += t.x * e), (this.y += t.y * e), this);
    }
    sub(t) {
      return ((this.x -= t.x), (this.y -= t.y), this);
    }
    subScalar(t) {
      return ((this.x -= t), (this.y -= t), this);
    }
    subVectors(t, e) {
      return ((this.x = t.x - e.x), (this.y = t.y - e.y), this);
    }
    multiply(t) {
      return ((this.x *= t.x), (this.y *= t.y), this);
    }
    multiplyScalar(t) {
      return ((this.x *= t), (this.y *= t), this);
    }
    divide(t) {
      return ((this.x /= t.x), (this.y /= t.y), this);
    }
    divideScalar(t) {
      return this.multiplyScalar(1 / t);
    }
    applyMatrix3(t) {
      const e = this.x,
        s = this.y,
        i = t.elements;
      return (
        (this.x = i[0] * e + i[3] * s + i[6]),
        (this.y = i[1] * e + i[4] * s + i[7]),
        this
      );
    }
    min(t) {
      return (
        (this.x = Math.min(this.x, t.x)),
        (this.y = Math.min(this.y, t.y)),
        this
      );
    }
    max(t) {
      return (
        (this.x = Math.max(this.x, t.x)),
        (this.y = Math.max(this.y, t.y)),
        this
      );
    }
    clamp(t, e) {
      return (
        (this.x = I(this.x, t.x, e.x)),
        (this.y = I(this.y, t.y, e.y)),
        this
      );
    }
    clampScalar(t, e) {
      return ((this.x = I(this.x, t, e)), (this.y = I(this.y, t, e)), this);
    }
    clampLength(t, e) {
      const s = this.length();
      return this.divideScalar(s || 1).multiplyScalar(I(s, t, e));
    }
    floor() {
      return (
        (this.x = Math.floor(this.x)),
        (this.y = Math.floor(this.y)),
        this
      );
    }
    ceil() {
      return ((this.x = Math.ceil(this.x)), (this.y = Math.ceil(this.y)), this);
    }
    round() {
      return (
        (this.x = Math.round(this.x)),
        (this.y = Math.round(this.y)),
        this
      );
    }
    roundToZero() {
      return (
        (this.x = Math.trunc(this.x)),
        (this.y = Math.trunc(this.y)),
        this
      );
    }
    negate() {
      return ((this.x = -this.x), (this.y = -this.y), this);
    }
    dot(t) {
      return this.x * t.x + this.y * t.y;
    }
    cross(t) {
      return this.x * t.y - this.y * t.x;
    }
    lengthSq() {
      return this.x * this.x + this.y * this.y;
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    manhattanLength() {
      return Math.abs(this.x) + Math.abs(this.y);
    }
    normalize() {
      return this.divideScalar(this.length() || 1);
    }
    angle() {
      return Math.atan2(-this.y, -this.x) + Math.PI;
    }
    angleTo(t) {
      const e = Math.sqrt(this.lengthSq() * t.lengthSq());
      if (e === 0) return Math.PI / 2;
      const s = this.dot(t) / e;
      return Math.acos(I(s, -1, 1));
    }
    distanceTo(t) {
      return Math.sqrt(this.distanceToSquared(t));
    }
    distanceToSquared(t) {
      const e = this.x - t.x,
        s = this.y - t.y;
      return e * e + s * s;
    }
    manhattanDistanceTo(t) {
      return Math.abs(this.x - t.x) + Math.abs(this.y - t.y);
    }
    setLength(t) {
      return this.normalize().multiplyScalar(t);
    }
    lerp(t, e) {
      return (
        (this.x += (t.x - this.x) * e),
        (this.y += (t.y - this.y) * e),
        this
      );
    }
    lerpVectors(t, e, s) {
      return (
        (this.x = t.x + (e.x - t.x) * s),
        (this.y = t.y + (e.y - t.y) * s),
        this
      );
    }
    equals(t) {
      return t.x === this.x && t.y === this.y;
    }
    fromArray(t, e = 0) {
      return ((this.x = t[e]), (this.y = t[e + 1]), this);
    }
    toArray(t = [], e = 0) {
      return ((t[e] = this.x), (t[e + 1] = this.y), t);
    }
    fromBufferAttribute(t, e) {
      return ((this.x = t.getX(e)), (this.y = t.getY(e)), this);
    }
    rotateAround(t, e) {
      const s = Math.cos(e),
        i = Math.sin(e),
        o = this.x - t.x,
        r = this.y - t.y;
      return (
        (this.x = o * s - r * i + t.x),
        (this.y = o * i + r * s + t.y),
        this
      );
    }
    random() {
      return ((this.x = Math.random()), (this.y = Math.random()), this);
    }
    *[Symbol.iterator]() {
      (yield this.x, yield this.y);
    }
  };
  G.prototype.isVector2 = !0;
  let W = G;
  const X = class X {
    constructor(t, e, s, i, o, r, h, c, l) {
      ((this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]),
        t !== void 0 && this.set(t, e, s, i, o, r, h, c, l));
    }
    set(t, e, s, i, o, r, h, c, l) {
      const u = this.elements;
      return (
        (u[0] = t),
        (u[1] = i),
        (u[2] = h),
        (u[3] = e),
        (u[4] = o),
        (u[5] = c),
        (u[6] = s),
        (u[7] = r),
        (u[8] = l),
        this
      );
    }
    identity() {
      return (this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this);
    }
    copy(t) {
      const e = this.elements,
        s = t.elements;
      return (
        (e[0] = s[0]),
        (e[1] = s[1]),
        (e[2] = s[2]),
        (e[3] = s[3]),
        (e[4] = s[4]),
        (e[5] = s[5]),
        (e[6] = s[6]),
        (e[7] = s[7]),
        (e[8] = s[8]),
        this
      );
    }
    extractBasis(t, e, s) {
      return (
        t.setFromMatrix3Column(this, 0),
        e.setFromMatrix3Column(this, 1),
        s.setFromMatrix3Column(this, 2),
        this
      );
    }
    setFromMatrix4(t) {
      const e = t.elements;
      return (
        this.set(e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]),
        this
      );
    }
    multiply(t) {
      return this.multiplyMatrices(this, t);
    }
    premultiply(t) {
      return this.multiplyMatrices(t, this);
    }
    multiplyMatrices(t, e) {
      const s = t.elements,
        i = e.elements,
        o = this.elements,
        r = s[0],
        h = s[3],
        c = s[6],
        l = s[1],
        u = s[4],
        a = s[7],
        M = s[2],
        v = s[5],
        d = s[8],
        w = i[0],
        x = i[3],
        k = i[6],
        m = i[1],
        f = i[4],
        y = i[7],
        p = i[2],
        S = i[5],
        g = i[8];
      return (
        (o[0] = r * w + h * m + c * p),
        (o[3] = r * x + h * f + c * S),
        (o[6] = r * k + h * y + c * g),
        (o[1] = l * w + u * m + a * p),
        (o[4] = l * x + u * f + a * S),
        (o[7] = l * k + u * y + a * g),
        (o[2] = M * w + v * m + d * p),
        (o[5] = M * x + v * f + d * S),
        (o[8] = M * k + v * y + d * g),
        this
      );
    }
    multiplyScalar(t) {
      const e = this.elements;
      return (
        (e[0] *= t),
        (e[3] *= t),
        (e[6] *= t),
        (e[1] *= t),
        (e[4] *= t),
        (e[7] *= t),
        (e[2] *= t),
        (e[5] *= t),
        (e[8] *= t),
        this
      );
    }
    determinant() {
      const t = this.elements,
        e = t[0],
        s = t[1],
        i = t[2],
        o = t[3],
        r = t[4],
        h = t[5],
        c = t[6],
        l = t[7],
        u = t[8];
      return (
        e * r * u - e * h * l - s * o * u + s * h * c + i * o * l - i * r * c
      );
    }
    invert() {
      const t = this.elements,
        e = t[0],
        s = t[1],
        i = t[2],
        o = t[3],
        r = t[4],
        h = t[5],
        c = t[6],
        l = t[7],
        u = t[8],
        a = u * r - h * l,
        M = h * c - u * o,
        v = l * o - r * c,
        d = e * a + s * M + i * v;
      if (d === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
      const w = 1 / d;
      return (
        (t[0] = a * w),
        (t[1] = (i * l - u * s) * w),
        (t[2] = (h * s - i * r) * w),
        (t[3] = M * w),
        (t[4] = (u * e - i * c) * w),
        (t[5] = (i * o - h * e) * w),
        (t[6] = v * w),
        (t[7] = (s * c - l * e) * w),
        (t[8] = (r * e - s * o) * w),
        this
      );
    }
    transpose() {
      let t;
      const e = this.elements;
      return (
        (t = e[1]),
        (e[1] = e[3]),
        (e[3] = t),
        (t = e[2]),
        (e[2] = e[6]),
        (e[6] = t),
        (t = e[5]),
        (e[5] = e[7]),
        (e[7] = t),
        this
      );
    }
    getNormalMatrix(t) {
      return this.setFromMatrix4(t).invert().transpose();
    }
    transposeIntoArray(t) {
      const e = this.elements;
      return (
        (t[0] = e[0]),
        (t[1] = e[3]),
        (t[2] = e[6]),
        (t[3] = e[1]),
        (t[4] = e[4]),
        (t[5] = e[7]),
        (t[6] = e[2]),
        (t[7] = e[5]),
        (t[8] = e[8]),
        this
      );
    }
    setUvTransform(t, e, s, i, o, r, h) {
      const c = Math.cos(o),
        l = Math.sin(o);
      return (
        this.set(
          s * c,
          s * l,
          -s * (c * r + l * h) + r + t,
          -i * l,
          i * c,
          -i * (-l * r + c * h) + h + e,
          0,
          0,
          1,
        ),
        this
      );
    }
    scale(t, e) {
      return (
        q("Matrix3: .scale() is deprecated. Use .makeScale() instead."),
        this.premultiply(j.makeScale(t, e)),
        this
      );
    }
    rotate(t) {
      return (
        q("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),
        this.premultiply(j.makeRotation(-t)),
        this
      );
    }
    translate(t, e) {
      return (
        q(
          "Matrix3: .translate() is deprecated. Use .makeTranslation() instead.",
        ),
        this.premultiply(j.makeTranslation(t, e)),
        this
      );
    }
    makeTranslation(t, e) {
      return (
        t.isVector2
          ? this.set(1, 0, t.x, 0, 1, t.y, 0, 0, 1)
          : this.set(1, 0, t, 0, 1, e, 0, 0, 1),
        this
      );
    }
    makeRotation(t) {
      const e = Math.cos(t),
        s = Math.sin(t);
      return (this.set(e, -s, 0, s, e, 0, 0, 0, 1), this);
    }
    makeScale(t, e) {
      return (this.set(t, 0, 0, 0, e, 0, 0, 0, 1), this);
    }
    equals(t) {
      const e = this.elements,
        s = t.elements;
      for (let i = 0; i < 9; i++) if (e[i] !== s[i]) return !1;
      return !0;
    }
    fromArray(t, e = 0) {
      for (let s = 0; s < 9; s++) this.elements[s] = t[s + e];
      return this;
    }
    toArray(t = [], e = 0) {
      const s = this.elements;
      return (
        (t[e] = s[0]),
        (t[e + 1] = s[1]),
        (t[e + 2] = s[2]),
        (t[e + 3] = s[3]),
        (t[e + 4] = s[4]),
        (t[e + 5] = s[5]),
        (t[e + 6] = s[6]),
        (t[e + 7] = s[7]),
        (t[e + 8] = s[8]),
        t
      );
    }
    clone() {
      return new this.constructor().fromArray(this.elements);
    }
  };
  X.prototype.isMatrix3 = !0;
  let R = X;
  const j = new R();
  function ht(n, t, e = 2) {
    const s = t && t.length,
      i = s ? t[0] * e : n.length;
    let o = K(n, 0, i, e, !0);
    const r = [];
    if (!o || o.next === o.prev) return r;
    let h, c, l;
    if ((s && (o = xt(n, t, o, e)), n.length > 80 * e)) {
      ((h = n[0]), (c = n[1]));
      let u = h,
        a = c;
      for (let M = e; M < i; M += e) {
        const v = n[M],
          d = n[M + 1];
        (v < h && (h = v),
          d < c && (c = d),
          v > u && (u = v),
          d > a && (a = d));
      }
      ((l = Math.max(u - h, a - c)), (l = l !== 0 ? 32767 / l : 0));
    }
    return (L(o, r, e, h, c, l, 0), r);
  }
  function K(n, t, e, s, i) {
    let o;
    if (i === kt(n, t, e, s) > 0)
      for (let r = t; r < e; r += s) o = nt((r / s) | 0, n[r], n[r + 1], o);
    else
      for (let r = e - s; r >= t; r -= s)
        o = nt((r / s) | 0, n[r], n[r + 1], o);
    return (o && z(o, o.next) && (V(o), (o = o.next)), o);
  }
  function b(n, t) {
    if (!n) return n;
    t || (t = n);
    let e = n,
      s;
    do
      if (
        ((s = !1), !e.steiner && (z(e, e.next) || Z(e.prev, e, e.next) === 0))
      ) {
        if ((V(e), (e = t = e.prev), e === e.next)) break;
        s = !0;
      } else e = e.next;
    while (s || e !== t);
    return t;
  }
  function L(n, t, e, s, i, o, r) {
    if (!n) return;
    !r && o && Mt(n, s, i, o);
    let h = n;
    for (; n.prev !== n.next; ) {
      const c = n.prev,
        l = n.next;
      if (o ? lt(n, s, i, o) : ct(n)) {
        (t.push(c.i, n.i, l.i), V(n), (n = l.next), (h = l.next));
        continue;
      }
      if (((n = l), n === h)) {
        r
          ? r === 1
            ? ((n = ut(b(n), t)), L(n, t, e, s, i, o, 2))
            : r === 2 && at(n, t, e, s, i, o)
          : L(b(n), t, e, s, i, o, 1);
        break;
      }
    }
  }
  function ct(n) {
    const t = n.prev,
      e = n,
      s = n.next;
    if (Z(t, e, s) >= 0) return !1;
    const i = t.x,
      o = e.x,
      r = s.x,
      h = t.y,
      c = e.y,
      l = s.y,
      u = Math.min(i, o, r),
      a = Math.min(h, c, l),
      M = Math.max(i, o, r),
      v = Math.max(h, c, l);
    let d = s.next;
    for (; d !== t; ) {
      if (
        d.x >= u &&
        d.x <= M &&
        d.y >= a &&
        d.y <= v &&
        C(i, h, o, c, r, l, d.x, d.y) &&
        Z(d.prev, d, d.next) >= 0
      )
        return !1;
      d = d.next;
    }
    return !0;
  }
  function lt(n, t, e, s) {
    const i = n.prev,
      o = n,
      r = n.next;
    if (Z(i, o, r) >= 0) return !1;
    const h = i.x,
      c = o.x,
      l = r.x,
      u = i.y,
      a = o.y,
      M = r.y,
      v = Math.min(h, c, l),
      d = Math.min(u, a, M),
      w = Math.max(h, c, l),
      x = Math.max(u, a, M),
      k = B(v, d, t, e, s),
      m = B(w, x, t, e, s);
    let f = n.prevZ,
      y = n.nextZ;
    for (; f && f.z >= k && y && y.z <= m; ) {
      if (
        (f.x >= v &&
          f.x <= w &&
          f.y >= d &&
          f.y <= x &&
          f !== i &&
          f !== r &&
          C(h, u, c, a, l, M, f.x, f.y) &&
          Z(f.prev, f, f.next) >= 0) ||
        ((f = f.prevZ),
        y.x >= v &&
          y.x <= w &&
          y.y >= d &&
          y.y <= x &&
          y !== i &&
          y !== r &&
          C(h, u, c, a, l, M, y.x, y.y) &&
          Z(y.prev, y, y.next) >= 0)
      )
        return !1;
      y = y.nextZ;
    }
    for (; f && f.z >= k; ) {
      if (
        f.x >= v &&
        f.x <= w &&
        f.y >= d &&
        f.y <= x &&
        f !== i &&
        f !== r &&
        C(h, u, c, a, l, M, f.x, f.y) &&
        Z(f.prev, f, f.next) >= 0
      )
        return !1;
      f = f.prevZ;
    }
    for (; y && y.z <= m; ) {
      if (
        y.x >= v &&
        y.x <= w &&
        y.y >= d &&
        y.y <= x &&
        y !== i &&
        y !== r &&
        C(h, u, c, a, l, M, y.x, y.y) &&
        Z(y.prev, y, y.next) >= 0
      )
        return !1;
      y = y.nextZ;
    }
    return !0;
  }
  function ut(n, t) {
    let e = n;
    do {
      const s = e.prev,
        i = e.next.next;
      (!z(s, i) &&
        tt(s, e, e.next, i) &&
        H(s, i) &&
        H(i, s) &&
        (t.push(s.i, e.i, i.i), V(e), V(e.next), (e = n = i)),
        (e = e.next));
    } while (e !== n);
    return b(e);
  }
  function at(n, t, e, s, i, o) {
    let r = n;
    do {
      let h = r.next.next;
      for (; h !== r.prev; ) {
        if (r.i !== h.i && wt(r, h)) {
          let c = et(r, h);
          ((r = b(r, r.next)),
            (c = b(c, c.next)),
            L(r, t, e, s, i, o, 0),
            L(c, t, e, s, i, o, 0));
          return;
        }
        h = h.next;
      }
      r = r.next;
    } while (r !== n);
  }
  function xt(n, t, e, s) {
    const i = [];
    for (let o = 0, r = t.length; o < r; o++) {
      const h = t[o] * s,
        c = o < r - 1 ? t[o + 1] * s : n.length,
        l = K(n, h, c, s, !1);
      (l === l.next && (l.steiner = !0), i.push(gt(l)));
    }
    i.sort(ft);
    for (let o = 0; o < i.length; o++) e = yt(i[o], e);
    return e;
  }
  function ft(n, t) {
    let e = n.x - t.x;
    if (e === 0 && ((e = n.y - t.y), e === 0)) {
      const s = (n.next.y - n.y) / (n.next.x - n.x),
        i = (t.next.y - t.y) / (t.next.x - t.x);
      e = s - i;
    }
    return e;
  }
  function yt(n, t) {
    const e = pt(n, t);
    if (!e) return t;
    const s = et(e, n);
    return (b(s, s.next), b(e, e.next));
  }
  function pt(n, t) {
    let e = t;
    const s = n.x,
      i = n.y;
    let o = -1 / 0,
      r;
    if (z(n, e)) return e;
    do {
      if (z(n, e.next)) return e.next;
      if (i <= e.y && i >= e.next.y && e.next.y !== e.y) {
        const a = e.x + ((i - e.y) * (e.next.x - e.x)) / (e.next.y - e.y);
        if (
          a <= s &&
          a > o &&
          ((o = a), (r = e.x < e.next.x ? e : e.next), a === s)
        )
          return r;
      }
      e = e.next;
    } while (e !== t);
    if (!r) return null;
    const h = r,
      c = r.x,
      l = r.y;
    let u = 1 / 0;
    e = r;
    do {
      if (
        s >= e.x &&
        e.x >= c &&
        s !== e.x &&
        Q(i < l ? s : o, i, c, l, i < l ? o : s, i, e.x, e.y)
      ) {
        const a = Math.abs(i - e.y) / (s - e.x);
        H(e, n) &&
          (a < u || (a === u && (e.x > r.x || (e.x === r.x && mt(r, e))))) &&
          ((r = e), (u = a));
      }
      e = e.next;
    } while (e !== h);
    return r;
  }
  function mt(n, t) {
    return Z(n.prev, n, t.prev) < 0 && Z(t.next, n, n.next) < 0;
  }
  function Mt(n, t, e, s) {
    let i = n;
    do
      (i.z === 0 && (i.z = B(i.x, i.y, t, e, s)),
        (i.prevZ = i.prev),
        (i.nextZ = i.next),
        (i = i.next));
    while (i !== n);
    ((i.prevZ.nextZ = null), (i.prevZ = null), dt(i));
  }
  function dt(n) {
    let t,
      e = 1;
    do {
      let s = n,
        i;
      n = null;
      let o = null;
      for (t = 0; s; ) {
        t++;
        let r = s,
          h = 0;
        for (let l = 0; l < e && (h++, (r = r.nextZ), !!r); l++);
        let c = e;
        for (; h > 0 || (c > 0 && r); )
          (h !== 0 && (c === 0 || !r || s.z <= r.z)
            ? ((i = s), (s = s.nextZ), h--)
            : ((i = r), (r = r.nextZ), c--),
            o ? (o.nextZ = i) : (n = i),
            (i.prevZ = o),
            (o = i));
        s = r;
      }
      ((o.nextZ = null), (e *= 2));
    } while (t > 1);
    return n;
  }
  function B(n, t, e, s, i) {
    return (
      (n = ((n - e) * i) | 0),
      (t = ((t - s) * i) | 0),
      (n = (n | (n << 8)) & 16711935),
      (n = (n | (n << 4)) & 252645135),
      (n = (n | (n << 2)) & 858993459),
      (n = (n | (n << 1)) & 1431655765),
      (t = (t | (t << 8)) & 16711935),
      (t = (t | (t << 4)) & 252645135),
      (t = (t | (t << 2)) & 858993459),
      (t = (t | (t << 1)) & 1431655765),
      n | (t << 1)
    );
  }
  function gt(n) {
    let t = n,
      e = n;
    do ((t.x < e.x || (t.x === e.x && t.y < e.y)) && (e = t), (t = t.next));
    while (t !== n);
    return e;
  }
  function Q(n, t, e, s, i, o, r, h) {
    return (
      (i - r) * (t - h) >= (n - r) * (o - h) &&
      (n - r) * (s - h) >= (e - r) * (t - h) &&
      (e - r) * (o - h) >= (i - r) * (s - h)
    );
  }
  function C(n, t, e, s, i, o, r, h) {
    return !(n === r && t === h) && Q(n, t, e, s, i, o, r, h);
  }
  function wt(n, t) {
    return (
      n.next.i !== t.i &&
      n.prev.i !== t.i &&
      !vt(n, t) &&
      ((H(n, t) &&
        H(t, n) &&
        St(n, t) &&
        (Z(n.prev, n, t.prev) || Z(n, t.prev, t))) ||
        (z(n, t) && Z(n.prev, n, n.next) > 0 && Z(t.prev, t, t.next) > 0))
    );
  }
  function Z(n, t, e) {
    return (t.y - n.y) * (e.x - t.x) - (t.x - n.x) * (e.y - t.y);
  }
  function z(n, t) {
    return n.x === t.x && n.y === t.y;
  }
  function tt(n, t, e, s) {
    const i = N(Z(n, t, e)),
      o = N(Z(n, t, s)),
      r = N(Z(e, s, n)),
      h = N(Z(e, s, t));
    return !!(
      (i !== o && r !== h) ||
      (i === 0 && P(n, e, t)) ||
      (o === 0 && P(n, s, t)) ||
      (r === 0 && P(e, n, s)) ||
      (h === 0 && P(e, t, s))
    );
  }
  function P(n, t, e) {
    return (
      t.x <= Math.max(n.x, e.x) &&
      t.x >= Math.min(n.x, e.x) &&
      t.y <= Math.max(n.y, e.y) &&
      t.y >= Math.min(n.y, e.y)
    );
  }
  function N(n) {
    return n > 0 ? 1 : n < 0 ? -1 : 0;
  }
  function vt(n, t) {
    let e = n;
    do {
      if (
        e.i !== n.i &&
        e.next.i !== n.i &&
        e.i !== t.i &&
        e.next.i !== t.i &&
        tt(e, e.next, n, t)
      )
        return !0;
      e = e.next;
    } while (e !== n);
    return !1;
  }
  function H(n, t) {
    return Z(n.prev, n, n.next) < 0
      ? Z(n, t, n.next) >= 0 && Z(n, n.prev, t) >= 0
      : Z(n, t, n.prev) < 0 || Z(n, n.next, t) < 0;
  }
  function St(n, t) {
    let e = n,
      s = !1;
    const i = (n.x + t.x) / 2,
      o = (n.y + t.y) / 2;
    do
      (e.y > o != e.next.y > o &&
        e.next.y !== e.y &&
        i < ((e.next.x - e.x) * (o - e.y)) / (e.next.y - e.y) + e.x &&
        (s = !s),
        (e = e.next));
    while (e !== n);
    return s;
  }
  function et(n, t) {
    const e = U(n.i, n.x, n.y),
      s = U(t.i, t.x, t.y),
      i = n.next,
      o = t.prev;
    return (
      (n.next = t),
      (t.prev = n),
      (e.next = i),
      (i.prev = e),
      (s.next = e),
      (e.prev = s),
      (o.next = s),
      (s.prev = o),
      s
    );
  }
  function nt(n, t, e, s) {
    const i = U(n, t, e);
    return (
      s
        ? ((i.next = s.next), (i.prev = s), (s.next.prev = i), (s.next = i))
        : ((i.prev = i), (i.next = i)),
      i
    );
  }
  function V(n) {
    ((n.next.prev = n.prev),
      (n.prev.next = n.next),
      n.prevZ && (n.prevZ.nextZ = n.nextZ),
      n.nextZ && (n.nextZ.prevZ = n.prevZ));
  }
  function U(n, t, e) {
    return {
      i: n,
      x: t,
      y: e,
      prev: null,
      next: null,
      z: 0,
      prevZ: null,
      nextZ: null,
      steiner: !1,
    };
  }
  function kt(n, t, e, s) {
    let i = 0;
    for (let o = t, r = e - s; o < e; o += s)
      ((i += (n[r] - n[o]) * (n[o + 1] + n[r + 1])), (r = o));
    return i;
  }
  class Et {
    static triangulate(t, e, s = 2) {
      return ht(t, e, s);
    }
  }
  class O {
    static area(t) {
      const e = t.length;
      let s = 0;
      for (let i = e - 1, o = 0; o < e; i = o++)
        s += t[i].x * t[o].y - t[o].x * t[i].y;
      return s * 0.5;
    }
    static isClockWise(t) {
      return O.area(t) < 0;
    }
    static triangulateShape(t, e) {
      const s = [],
        i = [],
        o = [];
      (st(t), it(s, t));
      let r = t.length;
      e.forEach(st);
      for (let c = 0; c < e.length; c++)
        (i.push(r), (r += e[c].length), it(s, e[c]));
      const h = Et.triangulate(s, i);
      for (let c = 0; c < h.length; c += 3) o.push(h.slice(c, c + 3));
      return o;
    }
  }
  function st(n) {
    const t = n.length;
    t > 2 && n[t - 1].equals(n[0]) && n.pop();
  }
  function it(n, t) {
    for (let e = 0; e < t.length; e++) (n.push(t[e].x), n.push(t[e].y));
  }
  (typeof __THREE_DEVTOOLS__ < "u" &&
    __THREE_DEVTOOLS__.dispatchEvent(
      new CustomEvent("register", { detail: { revision: "187" } }),
    ),
    typeof window < "u" &&
      (window.__THREE__
        ? J("WARNING: Multiple instances of Three.js being imported.")
        : (window.__THREE__ = "187")));
  (new R().set(-1, 0, 0, 0, 1, 0, 0, 0, 1),
    new R().set(-1, 0, 0, 0, 1, 0, 0, 0, 1));
  const $ = 1e-6,
    D = (n, t, e) =>
      (Math.round(n * 2e4) + 65536) * 17179869184 +
      (Math.round(t * 2e4) + 65536) * 131072 +
      (Math.round(e * 2e4) + 65536),
    Zt = (n, t, e) => {
      const s = n[3] + (t[3] - n[3]) * e,
        i = n[4] + (t[4] - n[4]) * e,
        o = n[5] + (t[5] - n[5]) * e,
        r = Math.hypot(s, i, o) || 1;
      return [
        n[0] + (t[0] - n[0]) * e,
        n[1] + (t[1] - n[1]) * e,
        n[2] + (t[2] - n[2]) * e,
        s / r,
        i / r,
        o / r,
      ];
    };
  function Tt(n, t, e, s, i) {
    const o = [],
      r = [];
    let h = !1;
    for (const c of n) {
      const [l, u, a] = c.v,
        M = l[0] * t + l[1] * e + l[2] * s - i,
        v = u[0] * t + u[1] * e + u[2] * s - i,
        d = a[0] * t + a[1] * e + a[2] * s - i,
        w = M <= $,
        x = v <= $,
        k = d <= $;
      if (w && x && k) {
        o.push(c);
        continue;
      }
      if (((h = !0), !w && !x && !k)) continue;
      const m = [],
        f = [],
        y = [
          [l, M, w],
          [u, v, x],
          [a, d, k],
        ];
      for (let p = 0; p < 3; p++) {
        const [S, g, E] = y[p],
          [F, _, T] = y[(p + 1) % 3];
        if ((E && m.push(S), E !== T)) {
          const A = Zt(S, F, g / (g - _));
          (m.push(A), f.push(A));
        }
      }
      f.length === 2 && r.push(f);
      for (let p = 1; p + 1 < m.length; p++)
        o.push({ v: [m[0], m[p], m[p + 1]], cap: c.cap });
    }
    return h ? { tris: o, segments: r } : null;
  }
  function Ft(n, t, e, s) {
    const i = new Map(),
      o = (p) => {
        const S = D(p[0], p[1], p[2]);
        return (i.has(S) || i.set(S, { k: S, p, links: [] }), i.get(S));
      };
    for (const [p, S] of n) {
      const g = o(p),
        E = o(S);
      g !== E && (g.links.push(E), E.links.push(g));
    }
    const r = new Set(),
      h = [];
    for (const p of i.values()) {
      if (r.has(p.k) || p.links.length < 2) continue;
      const S = [];
      let g = null,
        E = p;
      for (; E && !r.has(E.k); ) {
        (r.add(E.k), S.push(E.p));
        const F =
          E.links.find((_) => _ !== g && !r.has(_.k)) ??
          (E.links.includes(p) && S.length > 2, null);
        ((g = E), (E = F));
      }
      S.length >= 3 && h.push(S);
    }
    if (!h.length) return [];
    const c = Math.abs(t) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    let l = e * c[2] - s * c[1],
      u = s * c[0] - t * c[2],
      a = t * c[1] - e * c[0];
    const M = Math.hypot(l, u, a);
    ((l /= M), (u /= M), (a /= M));
    const v = e * a - s * u,
      d = s * l - t * a,
      w = t * u - e * l,
      x = h
        .map((p) => {
          const S = p.map(
            (g) =>
              new W(
                g[0] * l + g[1] * u + g[2] * a,
                g[0] * v + g[1] * d + g[2] * w,
              ),
          );
          return { loop: p, shape: S, area: Math.abs(O.area(S)) };
        })
        .sort((p, S) => S.area - p.area),
      k = (p, S) => {
        let g = !1;
        for (let E = 0, F = S.length - 1; E < S.length; F = E++)
          S[E].y > p.y != S[F].y > p.y &&
            p.x <
              ((S[F].x - S[E].x) * (p.y - S[E].y)) / (S[F].y - S[E].y) +
                S[E].x &&
            (g = !g);
        return g;
      },
      m = [];
    for (const p of x) {
      if (p.area < 1e-7) continue;
      const S = x.filter(
        (g) => g !== p && g.area > p.area && k(p.shape[0], g.shape),
      );
      if (S.length % 2 === 0) ((p.holes = []), m.push(p));
      else {
        const g = S.filter((E) => E.holes).sort((E, F) => E.area - F.area)[0];
        g && g.holes.push(p);
      }
    }
    const f = [],
      y = (p) => [p[0], p[1], p[2], t, e, s];
    for (const p of m) {
      const S = (T, A) =>
          O.area(T.shape) > 0 === A
            ? { shape: T.shape, loop: T.loop }
            : { shape: [...T.shape].reverse(), loop: [...T.loop].reverse() },
        g = S(p, !0),
        E = p.holes.map((T) => S(T, !1)),
        F = [...g.loop, ...E.flatMap((T) => T.loop)];
      let _ = [];
      try {
        _ = O.triangulateShape(
          g.shape,
          E.map((T) => T.shape),
        );
      } catch {
        _ = [];
      }
      for (const [T, A, rt] of _)
        f.push({ v: [y(F[T]), y(F[A]), y(F[rt])], cap: 1 });
    }
    return f;
  }
  function _t(n) {
    const t = new Map(),
      e = (i) => {
        for (; t.get(i) !== i; ) (t.set(i, t.get(t.get(i))), (i = t.get(i)));
        return i;
      };
    for (const i of n) {
      const o = i.v.map((r) => D(r[0], r[1], r[2]));
      for (const r of o) t.has(r) || t.set(r, r);
      (t.set(e(o[1]), e(o[0])), t.set(e(o[2]), e(o[0])));
    }
    const s = new Map();
    for (const i of n) {
      const o = e(D(i.v[0][0], i.v[0][1], i.v[0][2]));
      (s.has(o) || s.set(o, []), s.get(o).push(i));
    }
    return [...s.values()];
  }
  function bt(n) {
    let t = 0,
      e = 0,
      s = 0,
      i = 0;
    for (const {
      v: [x, k, m],
    } of n) {
      const f =
        x[0] * (k[1] * m[2] - k[2] * m[1]) -
        x[1] * (k[0] * m[2] - k[2] * m[0]) +
        x[2] * (k[0] * m[1] - k[1] * m[0]);
      ((t += f),
        (e += f * (x[0] + k[0] + m[0])),
        (s += f * (x[1] + k[1] + m[1])),
        (i += f * (x[2] + k[2] + m[2])));
    }
    if (((t /= 6), Math.abs(t) < 1e-6)) return null;
    ((e /= 24 * t), (s /= 24 * t), (i /= 24 * t));
    const o = n.length * 3,
      r = new Float32Array(o * 3),
      h = new Float32Array(o * 3),
      c = new Float32Array(o),
      l = new Map(),
      u = [],
      a = new Map();
    let M = 0;
    for (const x of n) {
      const k = [];
      for (const m of x.v) {
        ((r[M * 3] = m[0] - e),
          (r[M * 3 + 1] = m[1] - s),
          (r[M * 3 + 2] = m[2] - i),
          (h[M * 3] = m[3]),
          (h[M * 3 + 1] = m[4]),
          (h[M * 3 + 2] = m[5]),
          (c[M] = x.cap));
        const f = D(m[0], m[1], m[2]);
        let y = l.get(f);
        (y === void 0 &&
          ((y = u.length), l.set(f, y), u.push([m[0] - e, m[1] - s, m[2] - i])),
          k.push(y),
          M++);
      }
      if (!x.cap)
        for (let m = 0; m < 3; m++) {
          const f = k[m],
            y = k[(m + 1) % 3],
            p = f < y ? f * 16777216 + y : y * 16777216 + f;
          a.set(p, (a.get(p) ?? 0) + 1);
        }
    }
    const v = [];
    for (const [x, k] of a)
      k === 1 && v.push(...u[Math.floor(x / 16777216)], ...u[x % 16777216]);
    const d = [];
    let w = 0;
    for (const x of u)
      (d.push(x[0] * 0.95, x[1] * 0.95, x[2] * 0.95),
        (w = Math.max(w, Math.hypot(x[0], x[1], x[2]))));
    return {
      positions: r,
      normals: h,
      caps: c,
      centroid: [e, s, i],
      volume: Math.abs(t),
      lines: new Float32Array(v),
      hull: new Float32Array(d),
      radius: w,
    };
  }
  function It(n, t, e, s) {
    let i = 0;
    for (const {
      v: [o, r, h],
    } of n) {
      const c = r[1] - o[1],
        l = r[2] - o[2],
        u = h[1] - o[1],
        a = h[2] - o[2],
        M = c * a - l * u;
      if (Math.abs(M) < 1e-12) continue;
      const v = e - o[1],
        d = s - o[2],
        w = (v * a - d * u) / M,
        x = (c * d - l * v) / M;
      w < 0 ||
        x < 0 ||
        w + x > 1 ||
        (o[0] + (r[0] - o[0]) * w + (h[0] - o[0]) * x > t && i++);
    }
    return i % 2 === 1;
  }
  function zt(n, t, e, s, i, o = !1) {
    let r = 1e9,
      h = 1e9,
      c = 1e9,
      l = -1e9,
      u = -1e9,
      a = -1e9;
    for (const { v: w } of n)
      for (const x of w)
        ((r = Math.min(r, x[0])),
          (l = Math.max(l, x[0])),
          (h = Math.min(h, x[1])),
          (u = Math.max(u, x[1])),
          (c = Math.min(c, x[2])),
          (a = Math.max(a, x[2])));
    const M = Math.max(l - r, u - h, a - c);
    if (o) return At(n, t, s, i, M);
    const v = [];
    let d = 0;
    for (; v.length < s && d++ < s * 60; ) {
      let w, x, k;
      if (Math.random() < i) {
        const m = M * Math.pow(Math.random(), 2.1) * 0.85,
          f = Math.random() * Math.PI * 2,
          y = Math.acos(2 * Math.random() - 1);
        ((w = t.x + Math.sin(y) * Math.cos(f) * m + e.x * m * 0.5),
          (x = t.y + Math.sin(y) * Math.sin(f) * m + e.y * m * 0.5),
          (k = t.z + Math.cos(y) * m + e.z * m * 0.5));
      } else
        ((w = r + Math.random() * (l - r)),
          (x = h + Math.random() * (u - h)),
          (k = c + Math.random() * (a - c)));
      It(n, w, x, k) && v.push([w, x, k]);
    }
    return v;
  }
  function At(n, t, e, s, i) {
    let o = 0;
    const r = n.map(({ v: [l, u, a] }) => {
        const M = u[0] - l[0],
          v = u[1] - l[1],
          d = u[2] - l[2],
          w = a[0] - l[0],
          x = a[1] - l[1],
          k = a[2] - l[2];
        return (o += Math.hypot(v * k - d * x, d * w - M * k, M * x - v * w));
      }),
      h = i * 0.025,
      c = [];
    for (let l = 0; c.length < e && l < e * 200; l++) {
      const u = Math.random() * o;
      let a = 0,
        M = r.length - 1;
      for (; a < M; ) {
        const g = (a + M) >> 1;
        r[g] < u ? (a = g + 1) : (M = g);
      }
      const [v, d, w] = n[a].v,
        x = Math.sqrt(Math.random()),
        k = Math.random(),
        m = (g) => v[g] * (1 - x) + d[g] * x * (1 - k) + w[g] * x * k,
        f = m(0),
        y = m(1),
        p = m(2),
        S = Math.exp(-Math.hypot(f - t.x, y - t.y, p - t.z) / (i * 0.22));
      (Math.random() < s && Math.random() > S) ||
        c.some((g) => Math.hypot(g[0] - f, g[1] - y, g[2] - p) < h) ||
        c.push([f, y, p]);
    }
    return c;
  }
  function Rt(n, t) {
    const e = [];
    for (let s = 0; s < t.length; s++) {
      const i = t[s],
        o = t
          .filter((h, c) => c !== s)
          .sort(
            (h, c) =>
              (h[0] - i[0]) ** 2 +
              (h[1] - i[1]) ** 2 +
              (h[2] - i[2]) ** 2 -
              ((c[0] - i[0]) ** 2 + (c[1] - i[1]) ** 2 + (c[2] - i[2]) ** 2),
          );
      let r = n;
      for (const h of o) {
        let c = h[0] - i[0],
          l = h[1] - i[1],
          u = h[2] - i[2];
        const a = Math.hypot(c, l, u);
        if (a < 1e-5) continue;
        ((c /= a), (l /= a), (u /= a));
        const M =
            (c * (i[0] + h[0])) / 2 +
            (l * (i[1] + h[1])) / 2 +
            (u * (i[2] + h[2])) / 2,
          v = Tt(r, c, l, u, M);
        if (
          v &&
          ((r = v.tris),
          v.segments.length && (r = r.concat(Ft(v.segments, c, l, u))),
          !r.length)
        )
          break;
      }
      if (r.length)
        for (const h of _t(r)) {
          const c = bt(h);
          c && e.push(c);
        }
    }
    return e;
  }
  self.onmessage = ({
    data: {
      id: n,
      tris: t,
      impact: e,
      direction: s,
      count: i,
      focus: o,
      hollow: r,
    },
  }) => {
    const h = performance.now(),
      c = Rt(t, zt(t, e, s, i, o, r)),
      l = c.flatMap((u) => [
        u.positions.buffer,
        u.normals.buffer,
        u.caps.buffer,
        u.lines.buffer,
        u.hull.buffer,
      ]);
    self.postMessage({ id: n, pieces: c, ms: performance.now() - h }, l);
  };
})();
