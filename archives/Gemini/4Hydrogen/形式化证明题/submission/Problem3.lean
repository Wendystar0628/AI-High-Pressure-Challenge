import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Algebra.Polynomial.Splits
import Mathlib.Algebra.Group.Int.Units
import Mathlib.Tactic.Linarith

open Polynomial

private lemma sum_range_nine_div_pow (n : ℕ) :
    ∑ k ∈ Finset.range n, (9 : ℝ) / 9 ^ (n - k) = (9 / 8 : ℝ) * (1 - (1 / 9 : ℝ) ^ n) := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [Finset.sum_range_succ']
    have hcongr : ∑ k ∈ Finset.range n, (9 : ℝ) / 9 ^ (n + 1 - (k + 1)) =
        ∑ k ∈ Finset.range n, (9 : ℝ) / 9 ^ (n - k) :=
      Finset.sum_congr rfl fun k _ => by simp [Nat.succ_sub_succ]
    have hpow : (9 : ℝ) ^ n ≠ 0 := pow_ne_zero _ (by norm_num)
    rw [hcongr, ih, Nat.sub_zero, pow_succ, pow_succ, one_div, inv_pow]
    field_simp
    ring

private lemma norm_ten_sub_gt_one_of_root (f : ℤ[X])
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (hf0 : f ≠ 0)
    {z : ℂ} (hz : (f.map (Int.castRingHom ℂ)).eval z = 0) :
    1 < ‖(10 : ℂ) - z‖ := by
  by_contra! hle
  have hre : 9 ≤ z.re := by
    have h1 : ((10 : ℂ) - z).re ≤ ‖(10 : ℂ) - z‖ := Complex.re_le_norm _
    have h2 : ((10 : ℂ) - z).re = 10 - z.re := by simp
    linarith
  have hznorm : 9 ≤ ‖z‖ := hre.trans (Complex.re_le_norm z)
  have hz0 : z ≠ 0 := by
    intro h
    rw [h, norm_zero] at hznorm
    linarith
  let fC : ℂ[X] := f.map (Int.castRingHom ℂ)
  have hfC_coeff : ∀ k, fC.coeff k = (f.coeff k : ℂ) := fun k => by simp [fC]
  have hlc_ne : (f.leadingCoeff : ℂ) ≠ 0 := by
    exact_mod_cast leadingCoeff_ne_zero.mpr hf0
  have hdegC : fC.natDegree = f.natDegree := by
    refine natDegree_eq_of_le_of_coeff_ne_zero natDegree_map_le ?_
    simpa [fC] using hlc_ne
  change fC.eval z = 0 at hz
  rw [eval_eq_sum_range, hdegC] at hz
  set d := f.natDegree
  rcases Nat.lt_trichotomy d 1 with hd0 | hd1 | hd2
  · have hd_eq : d = 0 := by omega
    rw [hd_eq, Finset.sum_range_one, hfC_coeff 0, pow_zero, mul_one] at hz
    have hc0 : f.coeff 0 = 0 := by exact_mod_cast hz
    have hlc : f.leadingCoeff = 0 := by rw [leadingCoeff, show f.natDegree = 0 from hd_eq, hc0]
    exact hf0 (leadingCoeff_eq_zero.mp hlc)
  · rw [hd1, Finset.sum_range_succ, Finset.sum_range_one, hfC_coeff 0, hfC_coeff 1,
      pow_zero, pow_one, mul_one] at hz
    have hre0 := congrArg Complex.re hz
    simp only [Complex.add_re, Complex.mul_re, Complex.intCast_re, Complex.intCast_im,
      zero_mul, sub_zero, Complex.zero_re] at hre0
    have ha0 : (0 : ℝ) ≤ (f.coeff 0 : ℝ) := by exact_mod_cast (hdigit 0).1
    have ha1_ne : f.coeff 1 ≠ 0 := by
      have := leadingCoeff_ne_zero.mpr hf0
      rwa [leadingCoeff, show f.natDegree = 1 from hd1] at this
    have ha1 : (1 : ℝ) ≤ (f.coeff 1 : ℝ) := by
      have := (hdigit 1).1
      exact_mod_cast (by omega : 1 ≤ f.coeff 1)
    nlinarith
  · have hsplit : fC.eval z =
        (∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) * z ^ k) +
          (f.coeff (d - 1) : ℂ) * z ^ (d - 1) + (f.coeff d : ℂ) * z ^ d := by
      rw [eval_eq_sum_range, hdegC]
      have hd_eq : d + 1 = (d - 1) + 1 + 1 := by omega
      rw [hd_eq, Finset.sum_range_succ, Finset.sum_range_succ,
        show d - 1 + 1 = d by omega, hfC_coeff (d - 1), hfC_coeff d]
      congr 2
      exact Finset.sum_congr rfl fun k _ => by rw [hfC_coeff k]
    have hsum0 : (∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) * z ^ k) +
        (f.coeff (d - 1) : ℂ) * z ^ (d - 1) + (f.coeff d : ℂ) * z ^ d = 0 := by
      rw [← hsplit, eval_eq_sum_range, hdegC]
      exact hz
    have hzpow : z ^ (d - 1) ≠ 0 := pow_ne_zero _ hz0
    have hdiv_eq : (f.coeff d : ℂ) * z + (f.coeff (d - 1) : ℂ) =
        -(∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) / z ^ (d - 1 - k)) := by
      apply mul_right_cancel₀ hzpow
      have hterm : ∀ k ∈ Finset.range (d - 1),
          ((f.coeff k : ℂ) / z ^ (d - 1 - k)) * z ^ (d - 1) = (f.coeff k : ℂ) * z ^ k := by
        intro k hk
        rw [Finset.mem_range] at hk
        have hpow_split : z ^ (d - 1) = z ^ (d - 1 - k) * z ^ k := by
          rw [← pow_add, show d - 1 - k + k = d - 1 by omega]
        have hz1 : z ^ (d - 1 - k) ≠ 0 := pow_ne_zero _ hz0
        rw [hpow_split]
        field_simp
      have hzd : z ^ d = z * z ^ (d - 1) := by
        conv_lhs => rw [show d = (d - 1) + 1 by omega, pow_succ']
      calc ((f.coeff d : ℂ) * z + (f.coeff (d - 1) : ℂ)) * z ^ (d - 1)
          = (f.coeff d : ℂ) * z ^ d + (f.coeff (d - 1) : ℂ) * z ^ (d - 1) := by rw [hzd]; ring
        _ = -(∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) * z ^ k) := by
            linear_combination hsum0
        _ = -(∑ k ∈ Finset.range (d - 1), ((f.coeff k : ℂ) / z ^ (d - 1 - k)) * z ^ (d - 1)) := by
            congr 1
            exact (Finset.sum_congr rfl hterm).symm
        _ = -(∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) / z ^ (d - 1 - k)) * z ^ (d - 1) := by
            rw [← Finset.sum_mul, neg_mul]
    have hlhs_ge : 9 ≤ ‖(f.coeff d : ℂ) * z + (f.coeff (d - 1) : ℂ)‖ := by
      have had_ne : f.coeff d ≠ 0 := leadingCoeff_ne_zero.mpr hf0
      have had : (1 : ℝ) ≤ (f.coeff d : ℝ) := by
        have := (hdigit d).1
        exact_mod_cast (by omega : 1 ≤ f.coeff d)
      have had1 : (0 : ℝ) ≤ (f.coeff (d - 1) : ℝ) := by exact_mod_cast (hdigit (d - 1)).1
      have hre_ge : 9 ≤ ((f.coeff d : ℂ) * z + (f.coeff (d - 1) : ℂ)).re := by
        simp only [Complex.add_re, Complex.mul_re, Complex.intCast_re, Complex.intCast_im,
          zero_mul, sub_zero]
        nlinarith
      exact hre_ge.trans (Complex.re_le_norm _)
    have hrhs_lt : ‖-(∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) / z ^ (d - 1 - k))‖ < 9 := by
      rw [norm_neg]
      calc ‖∑ k ∈ Finset.range (d - 1), (f.coeff k : ℂ) / z ^ (d - 1 - k)‖
          ≤ ∑ k ∈ Finset.range (d - 1), ‖(f.coeff k : ℂ) / z ^ (d - 1 - k)‖ := norm_sum_le _ _
        _ ≤ ∑ k ∈ Finset.range (d - 1), (9 : ℝ) / 9 ^ (d - 1 - k) := by
            refine Finset.sum_le_sum fun k _ => ?_
            rw [norm_div, norm_pow, Complex.norm_intCast]
            have hc_le : (|(f.coeff k : ℝ)|) ≤ 9 := by
              rw [abs_of_nonneg (by exact_mod_cast (hdigit k).1)]
              exact_mod_cast (hdigit k).2
            have hp_pos : (0 : ℝ) < (9 : ℝ) ^ (d - 1 - k) := by positivity
            have hp_le : (9 : ℝ) ^ (d - 1 - k) ≤ ‖z‖ ^ (d - 1 - k) := by gcongr
            exact div_le_div₀ (by norm_num) hc_le hp_pos hp_le
        _ = (9 / 8 : ℝ) * (1 - (1 / 9 : ℝ) ^ (d - 1)) := sum_range_nine_div_pow (d - 1)
        _ < 9 := by
            have hpos : (0 : ℝ) < (1 / 9 : ℝ) ^ (d - 1) := by positivity
            linarith
    linarith [hdiv_eq ▸ hlhs_ge]

private lemma norm_multiset_prod_gt_one (s : Multiset ℂ) (hs : s ≠ 0)
    (hgt : ∀ z ∈ s, 1 < ‖z‖) : 1 < ‖s.prod‖ := by
  induction s using Multiset.induction_on with
  | empty => contradiction
  | cons a s ih =>
    rw [Multiset.prod_cons, norm_mul]
    have ha : 1 < ‖a‖ := hgt a (Multiset.mem_cons_self _ _)
    by_cases hs0 : s = 0
    · subst hs0; simpa using ha
    · have ih' := ih hs0 fun z hz => hgt z (Multiset.mem_cons_of_mem hz)
      nlinarith

private lemma isUnit_of_dvd_of_isUnit_eval_ten (f : ℤ[X])
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (hf0 : f ≠ 0)
    {u : ℤ[X]} (hudvd : u ∣ f) (hu_eval : IsUnit (u.eval 10)) : IsUnit u := by
  have hu0 : u ≠ 0 := by
    intro h0
    rw [h0, eval_zero] at hu_eval
    exact not_isUnit_zero hu_eval
  by_cases hdeg : u.natDegree = 0
  · rw [eq_C_of_natDegree_eq_zero hdeg] at hu_eval ⊢
    rw [eval_C] at hu_eval
    exact isUnit_C.mpr hu_eval
  · exfalso
    have hdeg_pos : 1 ≤ u.natDegree := Nat.pos_of_ne_zero hdeg
    let uC : ℂ[X] := u.map (Int.castRingHom ℂ)
    let fC : ℂ[X] := f.map (Int.castRingHom ℂ)
    have huc_lc : (u.leadingCoeff : ℂ) ≠ 0 := by
      exact_mod_cast leadingCoeff_ne_zero.mpr hu0
    have huc_deg : uC.natDegree = u.natDegree := by
      refine natDegree_eq_of_le_of_coeff_ne_zero natDegree_map_le ?_
      simpa [uC] using huc_lc
    have hsplit : uC.Splits := IsAlgClosed.splits uC
    have hev_prod := hsplit.eval_eq_prod_roots (10 : ℂ)
    have hroots_card : uC.roots.card = uC.natDegree := IsAlgClosed.card_roots_eq_natDegree
    have hmap_ne : uC.roots.map (fun z : ℂ => (10 : ℂ) - z) ≠ 0 := by
      rw [← Multiset.card_pos, Multiset.card_map, hroots_card, huc_deg]
      exact hdeg_pos
    have hroot_gt : ∀ w ∈ uC.roots.map (fun z : ℂ => (10 : ℂ) - z), 1 < ‖w‖ := by
      intro w hw
      rw [Multiset.mem_map] at hw
      obtain ⟨z, hz, rfl⟩ := hw
      have huCz : uC.eval z = 0 := isRoot_of_mem_roots hz
      have hdvdC : uC ∣ fC := Polynomial.map_dvd (Int.castRingHom ℂ) hudvd
      obtain ⟨q, hq⟩ := hdvdC
      have hfCz : fC.eval z = 0 := by rw [hq, eval_mul, huCz, zero_mul]
      exact norm_ten_sub_gt_one_of_root f hdigit hf0 hfCz
    have hprod_gt : 1 < ‖(uC.roots.map (fun z : ℂ => (10 : ℂ) - z)).prod‖ :=
      norm_multiset_prod_gt_one _ hmap_ne hroot_gt
    have hlc_ge : 1 ≤ ‖uC.leadingCoeff‖ := by
      have hlc_eq : uC.leadingCoeff = (u.leadingCoeff : ℂ) := by
        rw [leadingCoeff, leadingCoeff, huc_deg]
        simp [uC]
      rw [hlc_eq, Complex.norm_intCast]
      exact_mod_cast Int.one_le_abs (leadingCoeff_ne_zero.mpr hu0)
    have hev_norm_gt : 1 < ‖uC.eval 10‖ := by
      rw [hev_prod, norm_mul]
      nlinarith
    have hev_eq : uC.eval 10 = ((u.eval 10 : ℤ) : ℂ) := by
      change (u.map (Int.castRingHom ℂ)).eval ((Int.castRingHom ℂ) 10) =
        (Int.castRingHom ℂ) (u.eval 10)
      rw [eval_map]
      symm
      exact hom_eval₂ u (RingHom.id ℤ) (Int.castRingHom ℂ) 10
    have hev_norm_one : ‖uC.eval 10‖ = 1 := by
      rw [hev_eq, Complex.norm_intCast]
      rcases Int.isUnit_iff.mp hu_eval with h | h <;> simp [h]
    linarith

open Polynomial in
theorem problem3 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hf0 : f ≠ 0 := by
    intro h0
    rw [h0, eval_zero] at hp
    exact hp.ne_zero rfl
  refine ⟨fun hunit => ?_, fun g h hgh => ?_⟩
  · have : IsUnit (f.eval 10) := (evalRingHom 10).isUnit_map hunit
    exact hp.not_isUnit this
  · have hmul : f.eval 10 = g.eval 10 * h.eval 10 := by
      rw [hgh, eval_mul]
    have hp_irred : Irreducible (f.eval 10) := hp.irreducible
    rw [hmul] at hp_irred
    rcases hp_irred.isUnit_or_isUnit rfl with hg | hh
    · exact Or.inl (isUnit_of_dvd_of_isUnit_eval_ten f hdigit hf0 ⟨h, hgh⟩ hg)
    · exact Or.inr (isUnit_of_dvd_of_isUnit_eval_ten f hdigit hf0 ⟨g, by rw [hgh, mul_comm]⟩ hh)
