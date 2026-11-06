import Mathlib.NumberTheory.ArithmeticFunction.Misc
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.Data.Nat.Squarefree
import Mathlib.Data.Nat.Factorization.Induction

open Finset

namespace P7

lemma L0 (p : ℕ) [Fact p.Prime] (hp3 : 3 ≤ p) (D : Finset ℕ) (k : ZMod p)
    (h : ∀ x : ZMod p, ∑ d ∈ D, x ^ d = k * x) (c : ℕ) (hc : c < p - 1) (hc1 : c ≠ 1) :
    ((D.filter (fun d => d % (p - 1) = c)).card : ZMod p) = 0 := by
  have hdiv : ∀ e : ℕ, (p - 1 ∣ (p - 2) * c + e ↔ e % (p - 1) = c) := by
    intro e
    rw [← ZMod.natCast_eq_zero_iff, Nat.cast_add, Nat.cast_mul]
    have h2 : ((p - 2 : ℕ) : ZMod (p - 1)) = -1 := by
      rw [eq_neg_iff_add_eq_zero, ← Nat.cast_add_one,
        show p - 2 + 1 = p - 1 by omega, ZMod.natCast_self]
    rw [h2, neg_one_mul, neg_add_eq_zero, ZMod.natCast_eq_natCast_iff', Nat.mod_eq_of_lt hc,
      eq_comm]
  have key : ∀ e : ℕ, ∑ u : (ZMod p)ˣ, ((u : ZMod p)) ^ ((p - 2) * c + e)
      = if e % (p - 1) = c then -1 else 0 := by
    intro e
    rw [FiniteField.sum_pow_units, ZMod.card]
    simp only [hdiv]
  have h0 : ∑ u : (ZMod p)ˣ, (u : ZMod p) ^ ((p - 2) * c) * (∑ d ∈ D, (u : ZMod p) ^ d - k * u)
      = 0 := by
    apply Finset.sum_eq_zero; intro u _; rw [h u, sub_self, mul_zero]
  have h1 : ∀ u : (ZMod p)ˣ, (u : ZMod p) ^ ((p - 2) * c) * (∑ d ∈ D, (u : ZMod p) ^ d - k * u)
      = ∑ d ∈ D, (u : ZMod p) ^ ((p - 2) * c + d) - k * (u : ZMod p) ^ ((p - 2) * c + 1) := by
    intro u
    rw [mul_sub, Finset.mul_sum]
    simp only [pow_add, pow_one]
    ring
  simp_rw [h1] at h0
  rw [Finset.sum_sub_distrib, ← Finset.mul_sum, Finset.sum_comm] at h0
  simp only [key] at h0
  have h1p : 1 % (p - 1) = 1 := Nat.mod_eq_of_lt (by omega)
  rw [h1p, if_neg (Ne.symm hc1), mul_zero, sub_zero, Finset.sum_ite, Finset.sum_const_zero,
    add_zero, Finset.sum_const, nsmul_eq_mul, mul_neg_one, neg_eq_zero] at h0
  exact h0

lemma L1 (p r : ℕ) [Fact p.Prime] (hp3 : 3 ≤ p) (hrp : r ∣ p - 1) (D : Finset ℕ) (k : ZMod p)
    (h : ∀ x : ZMod p, ∑ d ∈ D, x ^ d = k * x) (P : ℕ → Prop) [DecidablePred P]
    (hP : ∀ a, P a ↔ P (a % r)) (hP1 : ¬ P 1) :
    ((D.filter P).card : ZMod p) = 0 := by
  have hmod : ∀ a, P (a % (p - 1)) ↔ P a := by
    intro a
    rw [hP (a % (p - 1)), Nat.mod_mod_of_dvd a hrp, ← hP]
  rw [Finset.card_eq_sum_card_fiberwise (f := fun d => d % (p - 1))
    (t := (range (p - 1)).filter P)]
  · push_cast
    apply Finset.sum_eq_zero
    intro c hc
    rw [Finset.mem_filter, Finset.mem_range] at hc
    have hc1 : c ≠ 1 := by rintro rfl; exact hP1 hc.2
    have : (D.filter P).filter (fun d => d % (p - 1) = c)
        = D.filter (fun d => d % (p - 1) = c) := by
      ext d
      simp only [Finset.mem_filter]
      constructor
      · rintro ⟨⟨hd, _⟩, hdc⟩; exact ⟨hd, hdc⟩
      · rintro ⟨hd, hdc⟩; refine ⟨⟨hd, ?_⟩, hdc⟩; rw [← hmod, hdc]; exact hc.2
    rw [this]
    exact L0 p hp3 D k h c hc.1 hc1
  · intro d hd
    simp only [Finset.mem_coe, Finset.mem_filter, Finset.mem_range] at hd ⊢
    exact ⟨Nat.mod_lt _ (by omega), (hmod d).mpr hd.2⟩

lemma Inv (n q : ℕ) (hn : n ≠ 0) (hs : Squarefree n) (hq : q.Prime) (hqn : q ∣ n)
    (P Q : ℕ → Prop) [DecidablePred P] [DecidablePred Q]
    (hPQ : ∀ d ∈ n.divisors, ¬ q ∣ d → ((P (q * d) ↔ Q d) ∧ (Q (q * d) ↔ P d))) :
    (n.divisors.filter P).card = (n.divisors.filter Q).card := by
  have hsplit : ∀ (R : ℕ → Prop) [DecidablePred R], (n.divisors.filter R).card =
      ((n.divisors.filter (fun d => ¬ q ∣ d)).filter R).card +
      ((n.divisors.filter (fun d => ¬ q ∣ d)).filter (fun d => R (q * d))).card := by
    intro R _
    rw [← Finset.card_filter_add_card_filter_not (fun d => ¬ q ∣ d) (s := n.divisors.filter R)]
    congr 1
    · rw [Finset.filter_filter, Finset.filter_filter]
      congr 1
      apply Finset.filter_congr
      intro x _; exact and_comm
    · apply Finset.card_nbij' (fun d => d / q) (fun d => q * d)
      · intro a ha
        simp only [Finset.mem_coe, Finset.mem_filter, Nat.mem_divisors, not_not] at ha ⊢
        obtain ⟨⟨⟨had, -⟩, hRa⟩, hqa⟩ := ha
        have hqa' : q * (a / q) = a := Nat.mul_div_cancel' hqa
        refine ⟨⟨⟨(Nat.div_dvd_of_dvd hqa).trans had, hn⟩, ?_⟩, ?_⟩
        · intro hq2
          have : q * q ∣ n := by
            have := Nat.mul_dvd_mul_left q hq2
            rw [hqa'] at this
            exact this.trans had
          have := hs q this
          exact hq.one_lt.ne' (Nat.isUnit_iff.mp this)
        · rw [hqa']; exact hRa
      · intro b hb
        simp only [Finset.mem_coe, Finset.mem_filter, Nat.mem_divisors, not_not] at hb ⊢
        obtain ⟨⟨⟨hbd, -⟩, hqb⟩, hRb⟩ := hb
        refine ⟨⟨⟨?_, hn⟩, hRb⟩, dvd_mul_right q b⟩
        exact Nat.Coprime.mul_dvd_of_dvd_of_dvd ((Nat.Prime.coprime_iff_not_dvd hq).mpr hqb)
          hqn hbd
      · intro a ha
        simp only [Finset.mem_coe, Finset.mem_filter, not_not] at ha
        exact Nat.mul_div_cancel' ha.2
      · intro b _
        exact Nat.mul_div_cancel_left b hq.pos
  rw [hsplit P, hsplit Q]
  have e1 : (n.divisors.filter (fun d => ¬ q ∣ d)).filter (fun d => P (q * d))
      = (n.divisors.filter (fun d => ¬ q ∣ d)).filter Q := by
    apply Finset.filter_congr
    intro x hx
    rw [Finset.mem_filter] at hx
    exact (hPQ x hx.1 hx.2).1
  have e2 : (n.divisors.filter (fun d => ¬ q ∣ d)).filter (fun d => Q (q * d))
      = (n.divisors.filter (fun d => ¬ q ∣ d)).filter P := by
    apply Finset.filter_congr
    intro x hx
    rw [Finset.mem_filter] at hx
    exact (hPQ x hx.1 hx.2).2
  rw [e1, e2, add_comm]

end P7

open P7 in
theorem problem7 (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  have := Fact.mk hp
  have := Fact.mk hr
  have hn0 : n ≠ 0 := by omega
  have hr3 : 3 ≤ r := by
    have : 2 ≤ 2 ^ (2 ^ m) := by
      calc 2 = 2 ^ 1 := by norm_num
      _ ≤ 2 ^ (2 ^ m) := Nat.pow_le_pow_right (by norm_num) Nat.one_le_two_pow
    omega
  have hpmod : p % r = 1 := by
    have := hpr; unfold Nat.ModEq at this; rw [this]; exact Nat.mod_eq_of_lt (by omega)
  have hrp : r ∣ p - 1 := by
    have := Nat.div_add_mod p r
    rw [hpmod] at this
    exact ⟨p / r, by omega⟩
  have hp3 : 3 ≤ p := by
    have := hp.two_le
    rcases Nat.lt_or_ge p 3 with h | h
    · have h2 : p = 2 := by omega
      rw [h2, Nat.mod_eq_of_lt (by omega)] at hpmod; omega
    · exact h
  have hcong : ∀ x : ZMod p, ∑ d ∈ n.divisors, x ^ d = ((n.divisors.card : ℕ) : ZMod p) * x := by
    intro x
    have h1 := ha (x.val : ℤ)
    have h2 : (p : ℤ) ∣ (∑ d ∈ n.divisors, ((x.val : ℤ)) ^ d)
        - ((n.divisors.card : ℕ) : ℤ) * (x.val : ℤ) :=
      (Int.natCast_dvd_natCast.mpr hpn).trans h1
    rw [← ZMod.intCast_zmod_eq_zero_iff_dvd] at h2
    push_cast at h2
    rw [ZMod.natCast_zmod_val] at h2
    exact sub_eq_zero.mp h2
  have hk : ¬ (p ∣ n.divisors.card) := by
    intro hdvd
    rw [Nat.card_divisors hn0, Prime.dvd_finsetProd_iff hp.prime] at hdvd
    obtain ⟨q, _, hdq⟩ := hdvd
    have h1 := (Nat.squarefree_iff_factorization_le_one hn0).mp hs q
    have h2 := Nat.le_of_dvd (by omega) hdq
    omega
  have hcontra : ∀ (P : ℕ → Prop) [DecidablePred P],
      ((n.divisors.filter P).card : ZMod p) = 0 →
      ((n.divisors.filter (fun d => ¬ P d)).card : ZMod p) = 0 → False := by
    intro P _ h1 h2
    apply hk
    rw [← ZMod.natCast_eq_zero_iff, ← Finset.card_filter_add_card_filter_not P, Nat.cast_add,
      h1, h2, add_zero]
  -- r does not divide n
  have hrn : ¬ r ∣ n := by
    intro hrn
    have hL : ((n.divisors.filter (fun d => r ∣ d)).card : ZMod p) = 0 := by
      apply L1 p r hp3 hrp n.divisors _ hcong (fun d => r ∣ d)
      · intro a; simp [Nat.dvd_iff_mod_eq_zero]
      · intro h; have := Nat.le_of_dvd one_pos h; omega
    apply hcontra (fun d => r ∣ d) hL
    rw [← Inv n r hn0 hs hr hrn (fun d => r ∣ d) (fun d => ¬ r ∣ d)]
    · exact hL
    · intro d _ hrd
      simp [hrd]
  have hneg1 : (-1 : ZMod r) ≠ 1 := by
    intro h
    have h2 : ((2 : ℕ) : ZMod r) = 0 := by
      rw [Nat.cast_ofNat]; linear_combination -h
    rw [ZMod.natCast_eq_zero_iff] at h2
    have := Nat.le_of_dvd (by norm_num) h2
    omega
  have hstep : ∀ j : ℕ, (∀ q, q.Prime → q ∣ n → ((q : ZMod r)) ^ (2 ^ (j + 1)) = 1) →
      (∀ q, q.Prime → q ∣ n → ((q : ZMod r)) ^ (2 ^ j) = 1) := by
    intro j hj
    by_contra hcon
    push_neg at hcon
    obtain ⟨q₀, hq₀, hq₀n, hne⟩ := hcon
    have hneg : ((q₀ : ZMod r)) ^ (2 ^ j) = -1 := by
      have h1 : ((q₀ : ZMod r)) ^ (2 ^ j) * ((q₀ : ZMod r)) ^ (2 ^ j) = 1 := by
        rw [← pow_add, ← two_mul, ← pow_succ']; exact hj q₀ hq₀ hq₀n
      rcases mul_self_eq_one_iff.mp h1 with h | h
      · exact absurd h hne
      · exact h
    have hQ : ((n.divisors.filter (fun d : ℕ => ((d : ZMod r)) ^ (2 ^ j) = -1)).card : ZMod p) = 0 := by
      apply L1 p r hp3 hrp n.divisors _ hcong
      · intro a; rw [ZMod.natCast_mod]
      · simp only [Nat.cast_one, one_pow]; exact fun h => hneg1 h.symm
    have hnP : ((n.divisors.filter (fun d : ℕ => ¬ ((d : ZMod r)) ^ (2 ^ j) = 1)).card : ZMod p)
        = 0 := by
      apply L1 p r hp3 hrp n.divisors _ hcong
      · intro a; rw [ZMod.natCast_mod]
      · simp
    apply hcontra (fun d : ℕ => ((d : ZMod r)) ^ (2 ^ j) = 1) _ hnP
    rw [Inv n q₀ hn0 hs hq₀ hq₀n (fun d : ℕ => ((d : ZMod r)) ^ (2 ^ j) = 1)
      (fun d : ℕ => ((d : ZMod r)) ^ (2 ^ j) = -1)]
    · exact hQ
    · intro d _ _
      simp only [Nat.cast_mul, mul_pow, hneg]
      constructor
      · rw [neg_one_mul, neg_eq_iff_eq_neg]
      · rw [neg_one_mul, neg_inj]
  -- descent
  have hbase : ∀ q, q.Prime → q ∣ n → ((q : ZMod r)) ^ (2 ^ (2 ^ m)) = 1 := by
    intro q hq hqn
    have hq0 : (q : ZMod r) ≠ 0 := by
      rw [Ne, ZMod.natCast_eq_zero_iff]
      intro hrq
      have := (Nat.prime_dvd_prime_iff_eq hr hq).mp hrq
      subst this
      exact hrn hqn
    have := ZMod.pow_card_sub_one_eq_one hq0
    have hr1 : r - 1 = 2 ^ (2 ^ m) := by omega
    rwa [hr1] at this
  have hdesc : ∀ t, t ≤ 2 ^ m → ∀ q, q.Prime → q ∣ n → ((q : ZMod r)) ^ (2 ^ (2 ^ m - t)) = 1 := by
    intro t
    induction t with
    | zero => intro _; simpa using hbase
    | succ t ih =>
      intro ht
      apply hstep
      have : 2 ^ m - (t + 1) + 1 = 2 ^ m - t := by omega
      rw [this]
      exact ih (by omega)
  have hprime : ∀ q, q.Prime → q ∣ n → (q : ZMod r) = 1 := by
    intro q hq hqn
    have := hdesc (2 ^ m) le_rfl q hq hqn
    simpa using this
  have hall : ∀ d, d ∣ n → (d : ZMod r) = 1 := by
    intro d
    induction d using induction_on_primes with
    | zero => intro h; exact absurd (Nat.eq_zero_of_zero_dvd h) hn0
    | one => intro _; simp
    | prime_mul q a hq ih =>
      intro h
      rw [Nat.cast_mul, hprime q hq (Dvd.dvd.trans (dvd_mul_right q a) h),
        ih (Dvd.dvd.trans (dvd_mul_left a q) h), one_mul]
  intro d hd
  rw [Nat.mem_divisors] at hd
  have := hall d hd.1
  rw [← Nat.cast_one, ZMod.natCast_eq_natCast_iff] at this
  exact this
