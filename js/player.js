/* ============================================================================
 * CASTELO DA BETINA — Betina (simulation only)
 * A small kinematic runner: walks on the height field, jumps, wades, carries
 * a bucket whose contents slosh and spill. Reports what happened through
 * `events`; the game decides what to do with it (sounds, particles, rules).
 * ========================================================================== */
(function (root) {
  'use strict';

  const { clamp } = root.HCR.math;

  class Betina {
    constructor(theme, world) {
      this.theme = theme;
      this.p = theme.physics;
      this.world = world;
      this.events = [];
      this.reset();
    }

    reset() {
      const w = this.world;
      this.x = w.startX;
      this.y = w.heightAt(this.x);
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.grounded = true;
      this.fill = 0;           // bucket 0..1
      this.slosh = 0;
      this.sloshV = 0;
      this.energy = this.p.energyMax;
      this.tired = false;
      this.stun = 0;
      this.invuln = 0;
      this.phase = 0;          // run cycle
      this.depth = 0;
      this.inWater = false;
      this.scooping = false;
      this.dumping = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.spillTimer = 0;
      this.hurt = 0;
    }

    emit(type, data) {
      this.events.push(Object.assign({ type }, data));
    }

    spill(amount, kind) {
      const lost = Math.min(this.fill, amount);
      if (lost <= 0) return 0;
      this.fill -= lost;
      this.emit('spill', { amount: lost, kind });
      return lost;
    }

    /** Crab contact: stumble, lose some of the bucket, bounce back. */
    hitByCrab(dir) {
      if (this.invuln > 0) return false;
      const p = this.p;
      this.stun = p.crabStun;
      this.invuln = 1.7;
      this.hurt = 1;
      this.vx = -dir * 190;
      this.vy = -320;
      this.grounded = false;
      this.energy = Math.max(0, this.energy - 6);
      this.spill(p.crabSpill, 'crab');
      this.emit('crab', {});
      return true;
    }

    /** A big wave knocks her back up the beach. */
    pushedByWave() {
      if (this.invuln > 0) return false;
      this.stun = 0.55;
      this.invuln = 2;
      this.vx = -540;
      this.vy = -240;
      this.grounded = false;
      this.spill(this.p.waveSpill, 'wave');
      this.emit('pushed', {});
      return true;
    }

    step(dt, input, castle) {
      const p = this.p;
      const w = this.world;
      let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

      this.stun = Math.max(0, this.stun - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.hurt = Math.max(0, this.hurt - dt * 1.6);
      if (this.stun > 0) dir = 0;

      const depth = w.depthAt(this.x);
      this.depth = depth;
      const wasInWater = this.inWater;
      this.inWater = this.x >= w.edge - 6;

      /* ------------------------------------------------------- horizontal */
      let cap = p.runSpeed * (1 - p.loadSlow * this.fill);
      if (this.tired) cap *= p.tiredSlow;
      if (depth > 0) cap *= 1 - clamp(depth / p.wadeFull, 0, 1) * p.wadeSlow;
      if (dir !== 0) cap *= clamp(1 + w.slopeAt(this.x) * dir * p.slopeGain, 0.7, 1.2);

      const control = this.grounded ? 1 : p.airControl;
      const prevVx = this.vx;
      if (dir !== 0) {
        const turning = Math.sign(this.vx) === -dir && Math.abs(this.vx) > 40 ? 1.6 : 1;
        const a = p.accel * control * turning * dt;
        this.vx += clamp(dir * cap - this.vx, -a, a);
        this.facing = dir;
      } else if (this.grounded) {
        const a = p.decel * dt;
        this.vx = Math.abs(this.vx) <= a ? 0 : this.vx - Math.sign(this.vx) * a;
      }

      this.x += this.vx * dt;
      if (this.x < w.minPlayX) { this.x = w.minPlayX; this.vx = Math.max(0, this.vx); }
      if (this.x > w.maxPlayX) { this.x = w.maxPlayX; this.vx = Math.min(0, this.vx); }

      /* --------------------------------------------------------- vertical */
      this.jumpBuf = input.jumpPressed ? 0.12 : Math.max(0, this.jumpBuf - dt);
      this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);

      if (this.jumpBuf > 0 && this.coyote > 0 && this.stun <= 0) {
        this.vy = -p.jumpSpeed * (depth > 20 ? 0.8 : 1);
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.energy = Math.max(0, this.energy - p.energyJump);
        this.emit('jump', {});
      }

      const ground = w.heightAt(this.x);
      if (this.grounded) {
        this.y = ground;
        this.vy = 0;
      } else {
        this.vy += p.gravity * dt;
        this.y += this.vy * dt;
        if (this.y >= ground) {
          const impact = this.vy;
          this.y = ground;
          this.vy = 0;
          this.grounded = true;
          this.sloshV += impact * p.landKick * (0.4 + this.fill);
          if (impact > 260) this.emit('land', { impact, wet: depth > 0 });
        }
      }

      /* --------------------------------------------------------- run cycle */
      const speed = Math.abs(this.vx);
      if (this.grounded && speed > 30) {
        const before = Math.floor(this.phase / Math.PI);
        this.phase += speed * dt * 0.052;
        if (Math.floor(this.phase / Math.PI) !== before) this.emit('step', { wet: depth > 0, speed });
      } else if (!this.grounded) {
        this.phase += speed * dt * 0.02;
      }

      /* ------------------------------------------------------------ bucket */
      const acc = (this.vx - prevVx) / dt;
      this.sloshV += -acc * p.sloshGain * dt;
      this.sloshV += (-p.sloshK * this.slosh - p.sloshC * this.sloshV) * dt;
      this.slosh += this.sloshV * dt;

      this.spillTimer = Math.max(0, this.spillTimer - dt);
      if (this.fill > 0.02) {
        const th = p.spillThreshold * (1.15 - 0.55 * this.fill);
        const over = Math.abs(this.slosh) - th;
        if (over > 0) {
          const amount = over * p.spillRate * dt;
          this.fill = Math.max(0, this.fill - amount);
          if (this.spillTimer <= 0) {
            this.spillTimer = 0.09;
            this.emit('spill', { amount, kind: 'slosh', dir: Math.sign(this.slosh) });
          }
        }
      }

      this.scooping = false;
      if (this.inWater && this.fill < 1 && this.stun <= 0) {
        this.scooping = true;
        if (!wasInWater || this.fill < 0.02) this.emit('scoopStart', {});
        this.fill = Math.min(1, this.fill + p.scoopRate * dt);
        if (this.fill >= 1) this.emit('bucketFull', {});
      }
      if (this.inWater && !wasInWater) this.emit('enterWater', { speed });
      if (!this.inWater && wasInWater) this.emit('leaveWater', {});

      this.dumping = false;
      if (
        castle && !castle.complete && this.fill > 0.02 &&
        Math.abs(this.x - w.castleX) < this.theme.castle.dumpHalf * castle.scale
      ) {
        this.dumping = true;
        const amount = Math.min(this.fill, p.dumpRate * dt);
        this.fill -= amount;
        this.emit('dump', { amount });
      }

      /* ----------------------------------------------------------- energy */
      const moving = this.grounded && speed > 40;
      if (moving) {
        this.energy -= p.energyRun * (1 + 0.4 * this.fill) * dt;
      } else if (speed < 20) {
        this.energy += (w.inShade(this.x) ? p.energyShade : p.energyIdle) * dt;
      }
      this.energy = clamp(this.energy, 0, p.energyMax);
      if (this.energy <= 0 && !this.tired) {
        this.tired = true;
        this.emit('tired', {});
      } else if (this.tired && this.energy >= p.tiredRecover) {
        this.tired = false;
      }
    }
  }

  root.HCR.Betina = Betina;
})(typeof window !== 'undefined' ? window : globalThis);
