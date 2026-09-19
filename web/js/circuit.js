'use strict';
// Порт core/linalg.gd + core/mna_system.gd + core/components.gd + core/circuit.gd.
// Логика скопирована штамп-в-штамп — числа должны совпадать с Godot-версией.

const Linalg = {
  luDecompose(a) {
    const n = a.length;
    const lu = a.map((row) => row.slice());
    const pivot = new Array(n);
    for (let i = 0; i < n; i++) pivot[i] = i;

    for (let k = 0; k < n; k++) {
      let maxVal = Math.abs(lu[k][k]);
      let maxRow = k;
      for (let i = k + 1; i < n; i++) {
        const v = Math.abs(lu[i][k]);
        if (v > maxVal) { maxVal = v; maxRow = i; }
      }
      if (maxVal < 1e-14) {
        return { lu, pivot, singular: true };
      }
      if (maxRow !== k) {
        const tmp = lu[k]; lu[k] = lu[maxRow]; lu[maxRow] = tmp;
        const tp = pivot[k]; pivot[k] = pivot[maxRow]; pivot[maxRow] = tp;
      }
      const pivotVal = lu[k][k];
      for (let i = k + 1; i < n; i++) {
        const factor = lu[i][k] / pivotVal;
        lu[i][k] = factor;
        if (factor !== 0.0) {
          for (let j = k + 1; j < n; j++) lu[i][j] -= factor * lu[k][j];
        }
      }
    }
    return { lu, pivot, singular: false };
  },

  luSolve(f, b) {
    if (f.singular) return [];
    const n = f.lu.length;
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = b[f.pivot[i]];
      const row = f.lu[i];
      for (let j = 0; j < i; j++) sum -= row[j] * y[j];
      y[i] = sum;
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      const row = f.lu[i];
      for (let j = i + 1; j < n; j++) sum -= row[j] * x[j];
      x[i] = sum / row[i];
    }
    return x;
  },

  zeroMatrix(n) {
    const m = [];
    for (let i = 0; i < n; i++) m.push(new Array(n).fill(0));
    return m;
  },

  zeroVector(n) { return new Array(n).fill(0); },
};

const GROUND = -1;
const GMIN = 1e-12; // раздел 10, «Защиты» — утечка с каждого узла на землю

class MnaSystem {
  constructor(nodeCount, sourceCount, dt = 0.0) {
    this.nodeCount = nodeCount;
    this.sourceCount = sourceCount;
    this.size = nodeCount + sourceCount;
    this.dt = dt;
    this.g = Linalg.zeroMatrix(this.size);
    this.rhs = Linalg.zeroVector(this.size);
    for (let i = 0; i < nodeCount; i++) this.g[i][i] += GMIN;
  }

  stampConductance(a, b, conductance) {
    if (a !== GROUND) this.g[a][a] += conductance;
    if (b !== GROUND) this.g[b][b] += conductance;
    if (a !== GROUND && b !== GROUND) {
      this.g[a][b] -= conductance;
      this.g[b][a] -= conductance;
    }
  }

  stampCurrentSource(a, b, current) {
    if (a !== GROUND) this.rhs[a] -= current;
    if (b !== GROUND) this.rhs[b] += current;
  }

  stampTransconductance(outA, outB, ctrlA, ctrlB, gm) {
    if (outA !== GROUND) {
      if (ctrlA !== GROUND) this.g[outA][ctrlA] += gm;
      if (ctrlB !== GROUND) this.g[outA][ctrlB] -= gm;
    }
    if (outB !== GROUND) {
      if (ctrlA !== GROUND) this.g[outB][ctrlA] -= gm;
      if (ctrlB !== GROUND) this.g[outB][ctrlB] += gm;
    }
  }

  stampVoltageSource(a, b, voltage, sourceIndex) {
    const row = this.nodeCount + sourceIndex;
    if (a !== GROUND) { this.g[row][a] += 1.0; this.g[a][row] += 1.0; }
    if (b !== GROUND) { this.g[row][b] -= 1.0; this.g[b][row] -= 1.0; }
    this.rhs[row] = voltage;
  }

  decompose() { return Linalg.luDecompose(this.g); }
  solveWith(factorization) { return Linalg.luSolve(factorization, this.rhs); }
}

class Component {
  constructor(nodeA, nodeB, name = '') {
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.name = name;
    this.sourceIndex = -1;
  }
  needsSourceRow() { return false; }
  stamp(_system) {}
  currentThrough(_v, _sourceCurrents) { return 0.0; }
  advance(_v) {}
  isNonlinear() { return false; }
  newtonJunctions() { return []; }
  newtonDelta(_index, _newV) { return 0.0; }
}

class Resistor extends Component {
  constructor(a, b, resistance, name = '') {
    super(a, b, name);
    this.resistance = Math.max(resistance, 1e-9);
  }
  stamp(system) { system.stampConductance(this.nodeA, this.nodeB, 1.0 / this.resistance); }
  currentThrough(v) { return (v(this.nodeA) - v(this.nodeB)) / this.resistance; }
}

class VoltageSource extends Component {
  constructor(a, b, voltage, name = '') { super(a, b, name); this.voltage = voltage; }
  needsSourceRow() { return true; }
  stamp(system) { system.stampVoltageSource(this.nodeA, this.nodeB, this.voltage, this.sourceIndex); }
  currentThrough(_v, sourceCurrents) { return sourceCurrents[this.sourceIndex]; }
}

class CurrentSource extends Component {
  constructor(a, b, current, name = '') { super(a, b, name); this.current = current; }
  stamp(system) { system.stampCurrentSource(this.nodeA, this.nodeB, this.current); }
  currentThrough() { return this.current; }
}

class Switch extends Component {
  constructor(a, b, closed, name = '') { super(a, b, name); this.closed = closed; }
  resistanceValue() { return this.closed ? Switch.R_ON : Switch.R_OFF; }
  stamp(system) { system.stampConductance(this.nodeA, this.nodeB, 1.0 / this.resistanceValue()); }
  currentThrough(v) { return (v(this.nodeA) - v(this.nodeB)) / this.resistanceValue(); }
}
Switch.R_ON = 1e-3;
Switch.R_OFF = 1e9;

class Capacitor extends Component {
  constructor(a, b, capacitance, name = '', initialVoltage = 0.0) {
    super(a, b, name);
    this.capacitance = Math.max(capacitance, 1e-15);
    this.vPrev = initialVoltage;
    this._g = 0.0;
  }
  stamp(system) {
    if (system.dt <= 0.0) { this._g = 0.0; return; }
    this._g = this.capacitance / system.dt;
    system.stampConductance(this.nodeA, this.nodeB, this._g);
    system.stampCurrentSource(this.nodeB, this.nodeA, this._g * this.vPrev);
  }
  currentThrough(v) {
    if (this._g === 0.0) return 0.0;
    return this._g * (v(this.nodeA) - v(this.nodeB)) - this._g * this.vPrev;
  }
  advance(v) {
    if (this._g === 0.0) return;
    this.vPrev = v(this.nodeA) - v(this.nodeB);
  }
}

class Inductor extends Component {
  constructor(a, b, inductance, name = '', initialCurrent = 0.0) {
    super(a, b, name);
    this.inductance = Math.max(inductance, 1e-15);
    this.iPrev = initialCurrent;
    this._g = 0.0;
  }
  stamp(system) {
    if (system.dt <= 0.0) { this._g = 0.0; return; }
    this._g = system.dt / this.inductance;
    system.stampConductance(this.nodeA, this.nodeB, this._g);
    system.stampCurrentSource(this.nodeA, this.nodeB, this.iPrev);
  }
  currentThrough(v) {
    if (this._g === 0.0) return this.iPrev;
    return this._g * (v(this.nodeA) - v(this.nodeB)) + this.iPrev;
  }
  advance(v) {
    if (this._g === 0.0) return;
    this.iPrev = this._g * (v(this.nodeA) - v(this.nodeB)) + this.iPrev;
  }
}

function diodeJunction(v, IS, VT, EXP_CLAMP) {
  const exponent = Math.max(-EXP_CLAMP, Math.min(EXP_CLAMP, v / VT));
  const e = Math.exp(exponent);
  return [IS * (e - 1.0), (IS / VT) * e];
}

class Diode extends Component {
  constructor(a, b, name = '') {
    super(a, b, name);
    this._guessV = 0.0;
    this._g = 0.0;
  }
  isNonlinear() { return true; }
  stamp(system) {
    const [iG, g] = diodeJunction(this._guessV, Diode.IS, Diode.VT, Diode.EXP_CLAMP);
    this._g = g;
    system.stampConductance(this.nodeA, this.nodeB, this._g);
    system.stampCurrentSource(this.nodeA, this.nodeB, iG - this._g * this._guessV);
  }
  currentThrough(v) {
    const vv = v(this.nodeA) - v(this.nodeB);
    return diodeJunction(vv, Diode.IS, Diode.VT, Diode.EXP_CLAMP)[0];
  }
  newtonJunctions() { return [[this.nodeA, this.nodeB]]; }
  newtonDelta(_index, newV) {
    const limited = Math.max(this._guessV - Diode.NEWTON_STEP_LIMIT, Math.min(this._guessV + Diode.NEWTON_STEP_LIMIT, newV));
    const delta = Math.abs(limited - this._guessV);
    this._guessV = limited;
    return delta;
  }
}
Diode.IS = 1e-12;
Diode.VT = 0.02585;
Diode.EXP_CLAMP = 40.0;
Diode.NEWTON_STEP_LIMIT = 10.0 * Diode.VT;

class Transistor extends Component {
  constructor(base, collector, emitter, name = '') {
    super(base, emitter, name); // nodeA = база, nodeB = эмиттер
    this.nodeC = collector;
    this._guessVbe = 0.0;
    this._guessVbc = 0.0;
    this._gF = 0.0;
    this._gR = 0.0;
  }
  isNonlinear() { return true; }
  stamp(system) {
    const [iF, gF] = diodeJunction(this._guessVbe, Transistor.IS, Transistor.VT, Transistor.EXP_CLAMP);
    const [iR, gR] = diodeJunction(this._guessVbc, Transistor.IS, Transistor.VT, Transistor.EXP_CLAMP);
    this._gF = gF; this._gR = gR;
    const cF = iF - gF * this._guessVbe;
    const cR = iR - gR * this._guessVbc;

    system.stampConductance(this.nodeA, this.nodeB, this._gF / Transistor.BF);
    system.stampCurrentSource(this.nodeA, this.nodeB, cF / Transistor.BF);

    // Переход база-коллектор у NPN — диод от БАЗЫ к коллектору, как и
    // база-эмиттер. Источник в его линеаризации должен течь база →
    // коллектор. Раньше он был развёрнут, и в активном режиме это не
    // замечалось (обратный ток там почти нулевой), а в насыщении
    // коллектор проваливался в минус на десятки вольт.
    system.stampConductance(this.nodeA, this.nodeC, this._gR / Transistor.BR);
    system.stampCurrentSource(this.nodeA, this.nodeC, cR / Transistor.BR);

    system.stampTransconductance(this.nodeC, this.nodeB, this.nodeA, this.nodeB, this._gF);
    system.stampTransconductance(this.nodeC, this.nodeB, this.nodeC, this.nodeA, this._gR);
    system.stampCurrentSource(this.nodeC, this.nodeB, cF - cR);
  }
  currentThrough(v) {
    const vb = v(this.nodeA), vc = v(this.nodeC), ve = v(this.nodeB);
    const iF = diodeJunction(vb - ve, Transistor.IS, Transistor.VT, Transistor.EXP_CLAMP)[0];
    const iR = diodeJunction(vb - vc, Transistor.IS, Transistor.VT, Transistor.EXP_CLAMP)[0];
    // Ток в коллектор: перенос минус то, что уходит в базу через
    // открытый переход база-коллектор.
    return (iF - iR) - iR / Transistor.BR;
  }
  newtonJunctions() { return [[this.nodeA, this.nodeB], [this.nodeA, this.nodeC]]; }
  newtonDelta(index, newV) {
    if (index === 0) {
      const limited = Math.max(this._guessVbe - Transistor.NEWTON_STEP_LIMIT, Math.min(this._guessVbe + Transistor.NEWTON_STEP_LIMIT, newV));
      const delta = Math.abs(limited - this._guessVbe);
      this._guessVbe = limited;
      return delta;
    }
    const limited = Math.max(this._guessVbc - Transistor.NEWTON_STEP_LIMIT, Math.min(this._guessVbc + Transistor.NEWTON_STEP_LIMIT, newV));
    const delta = Math.abs(limited - this._guessVbc);
    this._guessVbc = limited;
    return delta;
  }
}
Transistor.IS = 1e-12;
Transistor.VT = 0.02585;
Transistor.EXP_CLAMP = 40.0;
Transistor.NEWTON_STEP_LIMIT = 10.0 * Transistor.VT;
Transistor.BF = 100.0;
Transistor.BR = 4.0;

class Circuit {
  constructor() {
    this.nodeNames = new Map();
    this.nodeCount = 0;
    this.components = [];
    this.dt = 0.0;
    this.topologyDirty = true;
    this.cachedFactorization = null;
  }

  node(name) {
    if (name === 'GND') return GROUND;
    if (this.nodeNames.has(name)) return this.nodeNames.get(name);
    const idx = this.nodeCount;
    this.nodeNames.set(name, idx);
    this.nodeCount += 1;
    return idx;
  }

  _markDirty() { this.topologyDirty = true; }

  addResistor(a, b, resistance, name = '') {
    const c = new Resistor(this.node(a), this.node(b), resistance, name);
    this.components.push(c); this._markDirty(); return c;
  }
  addVoltageSource(a, b, voltage, name = '') {
    const c = new VoltageSource(this.node(a), this.node(b), voltage, name);
    this.components.push(c); this._markDirty(); return c;
  }
  addCurrentSource(a, b, current, name = '') {
    const c = new CurrentSource(this.node(a), this.node(b), current, name);
    this.components.push(c); this._markDirty(); return c;
  }
  addSwitch(a, b, closed, name = '') {
    const c = new Switch(this.node(a), this.node(b), closed, name);
    this.components.push(c); this._markDirty(); return c;
  }
  addCapacitor(a, b, capacitance, name = '', initialVoltage = 0.0) {
    const c = new Capacitor(this.node(a), this.node(b), capacitance, name, initialVoltage);
    this.components.push(c); this._markDirty(); return c;
  }
  addInductor(a, b, inductance, name = '', initialCurrent = 0.0) {
    const c = new Inductor(this.node(a), this.node(b), inductance, name, initialCurrent);
    this.components.push(c); this._markDirty(); return c;
  }
  addDiode(a, b, name = '') {
    const c = new Diode(this.node(a), this.node(b), name);
    this.components.push(c); this._markDirty(); return c;
  }
  addTransistor(base, collector, emitter, name = '') {
    const c = new Transistor(this.node(base), this.node(collector), this.node(emitter), name);
    this.components.push(c); this._markDirty(); return c;
  }

  setSwitch(sw, closed) {
    if (sw.closed === closed) return;
    sw.closed = closed;
    this._markDirty();
  }
  setResistance(r, resistance) {
    const clamped = Math.max(resistance, 1e-9);
    if (Math.abs(r.resistance - clamped) < 1e-12) return;
    r.resistance = clamped;
    this._markDirty();
  }

  _assignSourceRows() {
    let idx = 0;
    for (const c of this.components) if (c.needsSourceRow()) { c.sourceIndex = idx; idx += 1; }
    return idx;
  }

  _buildSystem() {
    const sourceCount = this._assignSourceRows();
    const system = new MnaSystem(this.nodeCount, sourceCount, this.dt);
    for (const c of this.components) c.stamp(system);
    return system;
  }

  setTimestep(h) {
    if (this.dt === h) return;
    this.dt = h;
    this._markDirty();
  }

  _rawSolve() {
    const system = this._buildSystem();
    if (this.topologyDirty || this.cachedFactorization === null) {
      this.cachedFactorization = system.decompose();
      this.topologyDirty = false;
    }
    return system.solveWith(this.cachedFactorization);
  }

  _hasNonlinear() { return this.components.some((c) => c.isNonlinear()); }

  _voltageLookup(x) { return (n) => (n === GROUND ? 0.0 : x[n]); }

  _newtonSolve() {
    const MAX_ITERATIONS = 100;
    const TOLERANCE = 1e-6;
    let x = [];
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      this.topologyDirty = true;
      x = this._rawSolve();
      if (x.length === 0) return x;
      const v = this._voltageLookup(x);
      let maxDelta = 0.0;
      for (const c of this.components) {
        if (!c.isNonlinear()) continue;
        const junctions = c.newtonJunctions();
        junctions.forEach((pair, idx) => {
          const vv = v(pair[0]) - v(pair[1]);
          maxDelta = Math.max(maxDelta, c.newtonDelta(idx, vv));
        });
      }
      if (maxDelta < TOLERANCE) break;
    }
    return x;
  }

  _extractSolution(x, sourceCount) {
    const sol = { nodeVoltage: {}, componentCurrent: {}, ok: true };
    for (const [name, idx] of this.nodeNames) sol.nodeVoltage[name] = x[idx];
    const sourceCurrents = new Array(sourceCount).fill(0);
    for (let i = 0; i < sourceCount; i++) sourceCurrents[i] = x[this.nodeCount + i];
    const v = this._voltageLookup(x);
    for (const c of this.components) {
      if (c.name) sol.componentCurrent[c.name] = c.currentThrough(v, sourceCurrents);
    }
    return sol;
  }

  solve() {
    const hasNonlinear = this._hasNonlinear();
    const x = hasNonlinear ? this._newtonSolve() : this._rawSolve();
    if (x.length === 0) {
      this.topologyDirty = true;
      return { nodeVoltage: {}, componentCurrent: {}, ok: false };
    }
    let sourceCount = 0;
    for (const c of this.components) if (c.needsSourceRow()) sourceCount += 1;
    const sol = this._extractSolution(x, sourceCount);
    const v = this._voltageLookup(x);
    for (const c of this.components) c.advance(v);
    return sol;
  }

  step(dt) {
    this.setTimestep(dt);
    return this.solve();
  }
}

function circuitCurrent(sol, name) {
  const v = sol.componentCurrent[name];
  return v === undefined ? 0.0 : v;
}
