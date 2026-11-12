import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Algebra.Polynomial.Reverse
import Mathlib.Algebra.Polynomial.Inductions
import Mathlib.Tactic.GCongr
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring

open Polynomial

private lemma digit_sum_bound (a : ℕ → ℂ) (ha : ∀ i, ‖a i‖ ≤ 9)
    (w : ℂ) (hw : ‖w‖ ≤ 1 / 9) (n : ℕ) :
    ‖∑ i ∈ Finset.range n, a i * w ^ i‖ ≤ 11 := by
  induction n generalizing a with
  | zero => simp
  | succ n ih =>
    rw [Finset.sum_range_succ']
    have heq : (∑ i ∈ Finset.range n, a (i + 1) * w ^ (i + 1)) =
        w * ∑ i ∈ Finset.range n, a (i + 1) * w ^ i := by
      rw [Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro i hi
      ring
    rw [heq]
    simp only [pow_zero, mul_one]
    calc
      ‖w * (∑ i ∈ Finset.range n, a (i + 1) * w ^ i) + a 0‖
          ≤ ‖w‖ * ‖∑ i ∈ Finset.range n, a (i + 1) * w ^ i‖ + ‖a 0‖ := by
            simpa only [norm_mul] using norm_add_le
              (w * ∑ i ∈ Finset.range n, a (i + 1) * w ^ i) (a 0)
      _ ≤ (1 / 9 : ℝ) * 11 + 9 := by
        gcongr
        exact ih (fun i => a (i + 1)) (fun i => ha (i + 1))
        exact ha 0
      _ ≤ 11 := by norm_num

private lemma digit_eval_bound (p : ℤ[X])
    (hd : ∀ n, 0 ≤ p.coeff n ∧ p.coeff n ≤ 9)
    (w : ℂ) (hw : ‖w‖ ≤ 1 / 9) :
    ‖p.eval₂ (Int.castRingHom ℂ) w‖ ≤ 11 := by
  rw [eval₂_eq_sum_range]
  apply digit_sum_bound _ _ w hw
  intro i
  change ‖(p.coeff i : ℂ)‖ ≤ 9
  rw [Complex.norm_intCast, abs_of_nonneg (show (0 : ℝ) ≤ p.coeff i by exact_mod_cast (hd i).1)]
  exact_mod_cast (hd i).2

-- The constant and linear terms have nonnegative real parts, while the tail has norm < 1.
private lemma digit_eval_ne_zero (p : ℤ[X])
    (hd : ∀ n, 0 ≤ p.coeff n ∧ p.coeff n ≤ 9) (h0 : 1 ≤ p.coeff 0)
    (w : ℂ) (hw : ‖w‖ ≤ 1 / 9) (hr : 0 ≤ w.re) :
    p.eval₂ (Int.castRingHom ℂ) w ≠ 0 := by
  have htail := digit_eval_bound (p.divX.divX)
    (fun n => by simpa only [coeff_divX] using hd (n + 1 + 1)) w hw
  have heq : p.eval₂ (Int.castRingHom ℂ) w =
      (p.coeff 0 : ℂ) + w * (p.coeff 1 : ℂ) +
        w ^ 2 * p.divX.divX.eval₂ (Int.castRingHom ℂ) w := by
    have h1 := congrArg (eval₂ (Int.castRingHom ℂ) w) (X_mul_divX_add p)
    have h2 := congrArg (eval₂ (Int.castRingHom ℂ) w) (X_mul_divX_add p.divX)
    simp only [eval₂_add, eval₂_mul, eval₂_X, eval₂_C, coeff_divX] at h1 h2
    rw [← h1, ← h2]
    norm_num
    ring
  have hnorm : ‖w ^ 2 * p.divX.divX.eval₂ (Int.castRingHom ℂ) w‖ ≤
      (1 / 9 : ℝ) ^ 2 * 11 := by
    rw [norm_mul, norm_pow]
    gcongr
  have hc0 : (1 : ℝ) ≤ p.coeff 0 := by exact_mod_cast h0
  have hc1 : (0 : ℝ) ≤ p.coeff 1 := by exact_mod_cast (hd 1).1
  have hre := (abs_le.mp (Complex.abs_re_le_norm (w ^ 2 * p.divX.divX.eval₂ (Int.castRingHom ℂ) w))).1
  intro hz
  rw [heq] at hz
  have hzre := congrArg Complex.re hz
  simp only [Complex.add_re, Complex.intCast_re, Complex.zero_re] at hzre
  have hmid : 0 ≤ (w * (p.coeff 1 : ℂ)).re := by
    simpa using mul_nonneg hr hc1
  linarith

-- Reverse the polynomial and evaluate at the reciprocal of a hypothetical nearby root.
private lemma digit_root_far (f : ℤ[X])
    (hd : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (hf : f ≠ 0)
    (z : ℂ) (hz : f.eval₂ (Int.castRingHom ℂ) z = 0) :
    1 < ‖(10 : ℂ) - z‖ := by
  by_contra! hdist
  have hr : 9 ≤ z.re := by
    have := Complex.re_le_norm ((10 : ℂ) - z)
    norm_num at this
    linarith
  have hn : 9 ≤ ‖z‖ := hr.trans (Complex.re_le_norm z)
  have hz0 : z ≠ 0 := by
    intro he
    norm_num [he] at hn
  have hi : ‖z⁻¹‖ ≤ 1 / 9 := by
    rw [norm_inv]
    simpa only [one_div] using
      (one_div_le_one_div_of_le (by norm_num : (0 : ℝ) < 9) hn)
  have hir : 0 ≤ (z⁻¹).re := by
    have hzre : 0 ≤ z.re := by linarith
    rw [Complex.inv_re]
    exact div_nonneg hzre (Complex.normSq_nonneg z)
  have hrev : ∀ n, 0 ≤ f.reverse.coeff n ∧ f.reverse.coeff n ≤ 9 := by
    intro n
    rw [coeff_reverse]
    exact hd _
  have hlc : 1 ≤ f.reverse.coeff 0 := by
    rw [coeff_zero_reverse]
    have := (hd f.natDegree).1
    have := leadingCoeff_ne_zero.mpr hf
    rw [leadingCoeff] at *
    omega
  have hne := digit_eval_ne_zero f.reverse hrev hlc z⁻¹ hi hir
  let : Invertible z := invertibleOfNonzero hz0
  apply hne
  simpa only [invOf_eq_inv] using
    (eval₂_reverse_eq_zero_iff (Int.castRingHom ℂ) z f).mpr hz

private lemma complex_prod_norm_gt_one (s : Multiset ℂ) (hs : s ≠ 0)
    (h : ∀ z ∈ s, 1 < ‖z‖) : 1 < ‖s.prod‖ := by
  have hle : ∀ t : Multiset ℂ, (∀ z ∈ t, 1 ≤ ‖z‖) → 1 ≤ ‖t.prod‖ := by
    intro t
    induction t using Multiset.induction_on with
    | empty => simp
    | cons a t ih =>
      intro ht
      have ha := ht a (by simp)
      have hb := ih (fun z hz => ht z (by simp [hz]))
      simp only [Multiset.prod_cons, norm_mul]
      nlinarith [norm_nonneg a, norm_nonneg t.prod]
  induction s using Multiset.induction_on with
  | empty => exact (hs rfl).elim
  | cons a t ih =>
    have ha := h a (by simp)
    have hb := hle t (fun z hz => (h z (by simp [hz])).le)
    simp only [Multiset.prod_cons, norm_mul]
    nlinarith [norm_nonneg a, norm_nonneg t.prod]

-- A nonconstant divisor would contribute a product of root distances strictly greater than 1.
private lemma digit_factor_unit (f g h : ℤ[X])
    (hd : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (hf : f ≠ 0)
    (hfg : f = g * h) (hu : IsUnit (g.eval 10)) : IsUnit g := by
  have hg0 : g ≠ 0 := by
    intro hg
    apply hf
    simp [hfg, hg]
  have hinj : Function.Injective (Int.castRingHom ℂ) := Int.cast_injective
  let G : ℂ[X] := g.map (Int.castRingHom ℂ)
  have hG0 : G ≠ 0 := (Polynomial.map_ne_zero_iff hinj).mpr hg0
  have hdeg : G.natDegree = g.natDegree := natDegree_map_eq_of_injective hinj g
  have hlead : G.leadingCoeff = (g.leadingCoeff : ℂ) :=
    leadingCoeff_map_of_injective hinj g
  have heval : G.eval 10 = ((g.eval (10 : ℤ) : ℤ) : ℂ) := by
    simp [G, eval_map]
  have hu_norm : ‖G.eval 10‖ = 1 := by
    rw [heval]
    rcases Int.isUnit_iff.mp hu with he | he <;> rw [he] <;> norm_num
  have hlead_norm : 1 ≤ ‖G.leadingCoeff‖ := by
    rw [hlead, Complex.norm_intCast]
    have habs : (1 : ℤ) ≤ |g.leadingCoeff| := by
      have := abs_pos.mpr (leadingCoeff_ne_zero.mpr hg0)
      omega
    exact_mod_cast habs
  have hs : G.Splits := IsAlgClosed.splits G
  have hzfar : ∀ z ∈ G.roots, 1 < ‖(10 : ℂ) - z‖ := by
    intro z hz
    apply digit_root_far f hd hf z
    have hgz : g.eval₂ (Int.castRingHom ℂ) z = 0 := by
      simpa only [G, IsRoot.def, eval_map] using (mem_roots hG0).mp hz
    rw [hfg, eval₂_mul, hgz, zero_mul]
  have hd0 : g.natDegree = 0 := by
    by_contra hn
    have hr0 : G.roots ≠ 0 := by
      intro he
      have hc := hs.natDegree_eq_card_roots
      rw [he, Multiset.card_zero] at hc
      exact hn (hdeg.symm.trans hc)
    have hprod : 1 < ‖(G.roots.map ((10 : ℂ) - ·)).prod‖ := by
      apply complex_prod_norm_gt_one
      · simpa using hr0
      · intro z hz
        obtain ⟨w, hw, rfl⟩ := Multiset.mem_map.mp hz
        exact hzfar w hw
    have hev := hs.eval_eq_prod_roots (10 : ℂ)
    have hevnorm := congrArg norm hev
    rw [norm_mul, hu_norm] at hevnorm
    nlinarith
  have hgC : g = C (g.coeff 0) := eq_C_of_natDegree_eq_zero hd0
  rw [hgC, eval_C] at hu
  rw [hgC]
  exact isUnit_C.mpr hu

open Polynomial in
theorem problem3 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hf : f ≠ 0 := by
    intro he
    apply hp.ne_zero
    simp [he]
  refine ⟨?_, ?_⟩
  · intro hu
    exact hp.not_isUnit (hu.map (evalRingHom (10 : ℤ)))
  · intro g h hfg
    have he : f.eval 10 = g.eval 10 * h.eval 10 := by rw [hfg, eval_mul]
    rcases hp.irreducible.isUnit_or_isUnit he with hg | hh
    · exact Or.inl (digit_factor_unit f g h hdigit hf hfg hg)
    · exact Or.inr (digit_factor_unit f h g hdigit hf (hfg.trans (mul_comm g h)) hh)

#print axioms problem3