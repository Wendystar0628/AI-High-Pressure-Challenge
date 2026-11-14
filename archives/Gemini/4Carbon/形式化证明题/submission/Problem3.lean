import Mathlib.Analysis.Complex.Polynomial.Basic

section Problem3Aux

open Polynomial

private lemma geom_sum_identity (r : ℝ) (m : ℕ) :
    (r - 1) * (∑ k ∈ Finset.range m, r ^ k) = r ^ m - 1 := by
  induction m with
  | zero => simp
  | succ m ih =>
    rw [Finset.sum_range_succ, mul_add, ih]
    ring

private lemma root_re_lt_four (f : ℤ[X]) (hf_ne : f ≠ 0)
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (z : ℂ)
    (hz : (f.map (Int.castRingHom ℂ)).eval z = 0) :
    z.re < 4 := by
  by_contra! hz4
  let d := f.natDegree
  have hlead_ne : f.coeff d ≠ 0 := Polynomial.leadingCoeff_ne_zero.mpr hf_ne
  have hlead_nonneg : 0 ≤ f.coeff d := (hdigit d).1
  have hlead_ge1 : 1 ≤ f.coeff d := by omega
  let fC : ℂ[X] := f.map (Int.castRingHom ℂ)
  have hfC_deg : fC.natDegree ≤ d := Polynomial.natDegree_map_le
  have hfC_coeff : ∀ k, fC.coeff k = (f.coeff k : ℂ) := fun k => Polynomial.coeff_map _ k
  by_cases hd0 : d = 0
  · have hlt1 : fC.natDegree < 1 := by omega
    rw [Polynomial.eval_eq_sum_range' hlt1 z, Finset.sum_range_one, hfC_coeff, pow_zero,
      mul_one] at hz
    have hc0 : f.coeff 0 = 0 := Int.cast_eq_zero.mp hz
    rw [hd0] at hlead_ge1
    omega
  · by_cases hd1 : d = 1
    · have hlt2 : fC.natDegree < 2 := by omega
      rw [Polynomial.eval_eq_sum_range' hlt2 z, Finset.sum_range_succ, Finset.sum_range_one,
        hfC_coeff, hfC_coeff, pow_zero, pow_one, mul_one] at hz
      have hre := congrArg Complex.re hz
      simp only [Complex.add_re, Complex.mul_re, Complex.intCast_re, Complex.intCast_im,
        zero_mul, sub_zero, Complex.zero_re] at hre
      have hc0 : (0 : ℝ) ≤ (f.coeff 0 : ℝ) := by exact_mod_cast (hdigit 0).1
      have hc1 : (1 : ℝ) ≤ (f.coeff 1 : ℝ) := by
        rw [hd1] at hlead_ge1
        exact_mod_cast hlead_ge1
      nlinarith
    · have hd_ge2 : 2 ≤ d := by omega
      let n := d - 2
      have hd_eq : d = n + 2 := by omega
      have hlt_n3 : fC.natDegree < n + 3 := by omega
      have heval := Polynomial.eval_eq_sum_range' hlt_n3 z
      rw [hz, Finset.sum_range_succ, Finset.sum_range_succ, hfC_coeff, hfC_coeff] at heval
      let w : ℂ := (f.coeff (n + 2) : ℂ) * z + (f.coeff (n + 1) : ℂ)
      have heq : z ^ (n + 1) * w = -∑ k ∈ Finset.range (n + 1), fC.coeff k * z ^ k := by
        dsimp only [w]
        linear_combination -heval
      have han2 : (1 : ℝ) ≤ (f.coeff (n + 2) : ℝ) := by
        rw [← hd_eq]
        exact_mod_cast hlead_ge1
      have han1 : (0 : ℝ) ≤ (f.coeff (n + 1) : ℝ) := by exact_mod_cast (hdigit (n + 1)).1
      have hnorm_zw : ‖z‖ ≤ ‖w‖ := by
        rw [Complex.norm_def, Complex.norm_def]
        apply Real.sqrt_le_sqrt
        rw [Complex.normSq_apply, Complex.normSq_apply]
        have hw_re : w.re = (f.coeff (n + 2) : ℝ) * z.re + (f.coeff (n + 1) : ℝ) := by
          simp [w]
        have hw_im : w.im = (f.coeff (n + 2) : ℝ) * z.im := by
          simp [w]
        rw [hw_re, hw_im]
        have hre_le : z.re ≤ (f.coeff (n + 2) : ℝ) * z.re + (f.coeff (n + 1) : ℝ) := by
          nlinarith
        have hre_sq : z.re * z.re ≤
            ((f.coeff (n + 2) : ℝ) * z.re + (f.coeff (n + 1) : ℝ)) *
            ((f.coeff (n + 2) : ℝ) * z.re + (f.coeff (n + 1) : ℝ)) := by
          nlinarith
        have him_sq : z.im * z.im ≤
            ((f.coeff (n + 2) : ℝ) * z.im) * ((f.coeff (n + 2) : ℝ) * z.im) := by
          have hsq : 0 ≤ ((f.coeff (n + 2) : ℝ) ^ 2 - 1) * (z.im * z.im) :=
            mul_nonneg (by nlinarith) (mul_self_nonneg z.im)
          nlinarith
        linarith
      let r := ‖z‖
      have hr4 : 4 ≤ r := le_trans hz4 (Complex.re_le_norm z)
      have hr_pos : 0 < r := by linarith
      have hlhs : r ^ (n + 2) ≤ ‖z ^ (n + 1) * w‖ := by
        rw [norm_mul, norm_pow]
        change r ^ (n + 2) ≤ r ^ (n + 1) * ‖w‖
        rw [pow_succ]
        exact mul_le_mul_of_nonneg_left hnorm_zw (pow_nonneg hr_pos.le _)
      have hrhs : ‖-∑ k ∈ Finset.range (n + 1), fC.coeff k * z ^ k‖ ≤
          9 * ∑ k ∈ Finset.range (n + 1), r ^ k := by
        rw [norm_neg, Finset.mul_sum]
        refine le_trans (norm_sum_le _ _) (Finset.sum_le_sum fun k _ => ?_)
        rw [hfC_coeff, norm_mul, norm_pow, Complex.norm_intCast]
        change |(f.coeff k : ℝ)| * r ^ k ≤ 9 * r ^ k
        have hk0 : (0 : ℝ) ≤ (f.coeff k : ℝ) := by exact_mod_cast (hdigit k).1
        have hk9 : (f.coeff k : ℝ) ≤ 9 := by exact_mod_cast (hdigit k).2
        rw [abs_of_nonneg hk0]
        exact mul_le_mul_of_nonneg_right hk9 (pow_nonneg hr_pos.le _)
      have hcomb : r ^ (n + 2) ≤ 9 * ∑ k ∈ Finset.range (n + 1), r ^ k :=
        le_trans hlhs (heq ▸ hrhs)
      have hmul := mul_le_mul_of_nonneg_left hcomb (show 0 ≤ r - 1 by linarith)
      have hrhs_eq : (r - 1) * (9 * ∑ k ∈ Finset.range (n + 1), r ^ k) =
          9 * (r ^ (n + 1) - 1) := by
        calc (r - 1) * (9 * ∑ k ∈ Finset.range (n + 1), r ^ k)
            = 9 * ((r - 1) * ∑ k ∈ Finset.range (n + 1), r ^ k) := by ring
          _ = 9 * (r ^ (n + 1) - 1) := by rw [geom_sum_identity]
      rw [hrhs_eq] at hmul
      have hlhs_ge : 12 * r ^ (n + 1) ≤ (r - 1) * r ^ (n + 2) := by
        have h12 : 12 ≤ (r - 1) * r := by nlinarith
        calc 12 * r ^ (n + 1) ≤ ((r - 1) * r) * r ^ (n + 1) :=
              mul_le_mul_of_nonneg_right h12 (pow_nonneg hr_pos.le _)
          _ = (r - 1) * r ^ (n + 2) := by rw [pow_succ]; ring
      have hpow_pos : 0 < r ^ (n + 1) := pow_pos hr_pos _
      linarith

private lemma multiset_prod_norm_ge_one (M : Multiset ℂ)
    (h : ∀ z ∈ M, 1 ≤ ‖(10 : ℂ) - z‖) :
    1 ≤ ‖(M.map (fun z => (10 : ℂ) - z)).prod‖ := by
  induction M using Multiset.induction_on with
  | empty => simp
  | cons a s ih =>
    rw [Multiset.map_cons, Multiset.prod_cons, norm_mul]
    have ha : 1 ≤ ‖(10 : ℂ) - a‖ := h a (Multiset.mem_cons_self a s)
    have hs : 1 ≤ ‖(s.map (fun z => (10 : ℂ) - z)).prod‖ :=
      ih (fun z hz => h z (Multiset.mem_cons_of_mem hz))
    nlinarith

private lemma multiset_prod_norm_gt_one (M : Multiset ℂ) (hne : M ≠ 0)
    (h : ∀ z ∈ M, 1 < ‖(10 : ℂ) - z‖) :
    1 < ‖(M.map (fun z => (10 : ℂ) - z)).prod‖ := by
  obtain ⟨a, ha⟩ := Multiset.exists_mem_of_ne_zero hne
  rw [← Multiset.cons_erase ha, Multiset.map_cons, Multiset.prod_cons, norm_mul]
  have ha1 : 1 < ‖(10 : ℂ) - a‖ := h a ha
  have hs1 : 1 ≤ ‖((M.erase a).map (fun z => (10 : ℂ) - z)).prod‖ :=
    multiset_prod_norm_ge_one _ (fun z hz => (h z (Multiset.mem_of_mem_erase hz)).le)
  nlinarith

private lemma factor_isUnit (f g h : ℤ[X]) (hf_ne : f ≠ 0)
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hf_eq : f = g * h) (hug : IsUnit (g.eval 10)) :
    IsUnit g := by
  by_cases hg0 : g.natDegree = 0
  · rw [Polynomial.eq_C_of_natDegree_eq_zero hg0] at hug ⊢
    rw [Polynomial.eval_C] at hug
    exact hug.map C
  · exfalso
    have hg_ne : g ≠ 0 := by
      intro h0
      subst h0
      simp at hf_eq
      exact hf_ne hf_eq
    let φ := Int.castRingHom ℂ
    have hφ_inj : Function.Injective φ := Int.cast_injective
    let gC : ℂ[X] := g.map φ
    let fC : ℂ[X] := f.map φ
    have hgC_deg : gC.natDegree = g.natDegree :=
      Polynomial.natDegree_map_eq_of_injective hφ_inj g
    have hgC_lead : gC.leadingCoeff = (g.leadingCoeff : ℂ) :=
      Polynomial.leadingCoeff_map_of_injective hφ_inj g
    have hsplits : gC.Splits := IsAlgClosed.splits gC
    have hroots_ne : gC.roots ≠ 0 := by
      intro hr0
      have hcard := hsplits.natDegree_eq_card_roots
      rw [hr0, Multiset.card_zero, hgC_deg] at hcard
      exact hg0 hcard
    have hroots_gt1 : ∀ z ∈ gC.roots, 1 < ‖(10 : ℂ) - z‖ := by
      intro z hz
      have hg_root : gC.eval z = 0 := (Polynomial.mem_roots_iff_aeval_eq_zero
        (by intro hc; rw [hc, Polynomial.natDegree_zero] at hgC_deg; exact hg0 hgC_deg.symm)).mp hz
      have hfC_eq : fC = gC * h.map φ := by
        dsimp only [fC, gC]
        rw [hf_eq, Polynomial.map_mul]
      have hf_root : fC.eval z = 0 := by
        rw [hfC_eq, Polynomial.eval_mul, hg_root, zero_mul]
      have hre : z.re < 4 := root_re_lt_four f hf_ne hdigit z hf_root
      have hre10 : 6 < ((10 : ℂ) - z).re := by
        simp only [Complex.sub_re]
        have : (10 : ℂ).re = 10 := by norm_num
        linarith
      exact lt_of_lt_of_le (by linarith) (Complex.re_le_norm ((10 : ℂ) - z))
    have hprod_gt1 : 1 < ‖(gC.roots.map ((10 : ℂ) - ·)).prod‖ :=
      multiset_prod_norm_gt_one gC.roots hroots_ne hroots_gt1
    have hlead_ge1 : 1 ≤ ‖gC.leadingCoeff‖ := by
      rw [hgC_lead, Complex.norm_intCast]
      have hne : g.leadingCoeff ≠ 0 := Polynomial.leadingCoeff_ne_zero.mpr hg_ne
      have h1 : (1 : ℤ) ≤ |g.leadingCoeff| := Int.one_le_abs hne
      exact_mod_cast h1
    have heval_prod := hsplits.eval_eq_prod_roots (10 : ℂ)
    have hnorm_eval_gt1 : 1 < ‖gC.eval (10 : ℂ)‖ := by
      rw [heval_prod, norm_mul]
      nlinarith
    have heval_cast : gC.eval (10 : ℂ) = ((g.eval 10 : ℤ) : ℂ) := by
      have h10 : (10 : ℂ) = φ 10 := by simp [φ]
      rw [h10, Polynomial.eval_map, Polynomial.eval₂_hom]
      rfl
    have hnorm_eval_eq1 : ‖gC.eval (10 : ℂ)‖ = 1 := by
      rw [heval_cast, Complex.norm_intCast]
      rcases Int.isUnit_iff.mp hug with h1 | hm1
      · rw [h1]; simp
      · rw [hm1]; simp
    linarith

private lemma problem3_aux (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hf_not_unit : ¬ IsUnit f :=
    fun hu => hp.not_isUnit (hu.map (Polynomial.evalRingHom 10))
  have hf_ne : f ≠ 0 := by
    intro h0
    subst h0
    exact hp.ne_zero Polynomial.eval_zero
  refine irreducible_iff.mpr ⟨hf_not_unit, fun g h hf_eq => ?_⟩
  have heval10 : f.eval 10 = g.eval 10 * h.eval 10 := by
    rw [hf_eq, Polynomial.eval_mul]
  rcases hp.irreducible.isUnit_or_isUnit heval10 with hug | huh
  · exact Or.inl (factor_isUnit f g h hf_ne hdigit hf_eq hug)
  · exact Or.inr (factor_isUnit f h g hf_ne hdigit (hf_eq.trans (mul_comm g h)) huh)

end Problem3Aux

open Polynomial in
theorem problem3 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  exact problem3_aux f hdigit hp
