import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Algebra.Ring.GeomSum

open Polynomial

namespace P6

lemma geom_lt (R : ℝ) (hR : 2 ≤ R) (m : ℕ) : ∑ k ∈ Finset.range m, R ^ k < R ^ m := by
  have h := geom_sum_mul R m
  have hs : 0 ≤ ∑ k ∈ Finset.range m, R ^ k :=
    Finset.sum_nonneg (fun k _ => pow_nonneg (by linarith) k)
  nlinarith

lemma root_bound (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9) (hf0 : f ≠ 0)
    (z : ℂ) (hz : ‖z - 10‖ ≤ 1) : (f.map (Int.castRingHom ℂ)).eval z ≠ 0 := by
  have hre : 9 ≤ z.re := by
    have := Complex.abs_re_le_norm (z - 10)
    rw [Complex.sub_re] at this
    have h10 : (10 : ℂ).re = 10 := by norm_num
    rw [h10] at this
    have := (abs_le.mp (this.trans hz)).1
    linarith
  have hnorm : 9 ≤ ‖z‖ := hre.trans (Complex.re_le_norm z)
  have hlead : 1 ≤ f.coeff f.natDegree := by
    have h1 : f.coeff f.natDegree ≠ 0 := leadingCoeff_ne_zero.mpr hf0
    have := (hdigit f.natDegree).1
    omega
  rw [eval_map, eval₂_eq_sum_range]
  simp only [eq_intCast]
  by_cases h0 : f.natDegree = 0
  · rw [h0] at hlead ⊢
    simp only [zero_add, Finset.sum_range_one, pow_zero, mul_one]
    exact_mod_cast (show f.coeff 0 ≠ 0 by omega)
  obtain ⟨m, hm⟩ := Nat.exists_eq_succ_of_ne_zero h0
  rw [hm] at hlead ⊢
  rw [Finset.sum_range_succ, Finset.sum_range_succ]
  intro hsum
  have htop : 9 * ‖z‖ ^ m ≤
      ‖((f.coeff m : ℤ) : ℂ) * z ^ m + ((f.coeff (m + 1) : ℤ) : ℂ) * z ^ (m + 1)‖ := by
    have e : ((f.coeff m : ℤ) : ℂ) * z ^ m + ((f.coeff (m + 1) : ℤ) : ℂ) * z ^ (m + 1)
        = z ^ m * (((f.coeff m : ℤ) : ℂ) + ((f.coeff (m + 1) : ℤ) : ℂ) * z) := by ring
    rw [e, norm_mul, norm_pow]
    have hre2 : 9 ≤ (((f.coeff m : ℤ) : ℂ) + ((f.coeff (m + 1) : ℤ) : ℂ) * z).re := by
      simp only [Complex.add_re, Complex.intCast_re, Complex.mul_re, Complex.intCast_im,
        zero_mul, sub_zero]
      have h1 : (0 : ℝ) ≤ (f.coeff m : ℝ) := by exact_mod_cast (hdigit m).1
      have h2 : (1 : ℝ) ≤ (f.coeff (m + 1) : ℝ) := by exact_mod_cast hlead
      nlinarith
    have h3 := hre2.trans (Complex.re_le_norm _)
    have hpos : 0 ≤ ‖z‖ ^ m := pow_nonneg (norm_nonneg _) _
    nlinarith
  have hlow : ‖∑ k ∈ Finset.range m, ((f.coeff k : ℤ) : ℂ) * z ^ k‖ < 9 * ‖z‖ ^ m := by
    calc ‖∑ k ∈ Finset.range m, ((f.coeff k : ℤ) : ℂ) * z ^ k‖
        ≤ ∑ k ∈ Finset.range m, ‖((f.coeff k : ℤ) : ℂ) * z ^ k‖ := norm_sum_le _ _
      _ ≤ ∑ k ∈ Finset.range m, 9 * ‖z‖ ^ k := by
          apply Finset.sum_le_sum; intro k _
          rw [norm_mul, norm_pow, Complex.norm_intCast]
          have h1 : (0 : ℝ) ≤ (f.coeff k : ℝ) := by exact_mod_cast (hdigit k).1
          have h2 : (f.coeff k : ℝ) ≤ 9 := by exact_mod_cast (hdigit k).2
          rw [abs_of_nonneg h1]
          exact mul_le_mul_of_nonneg_right h2 (pow_nonneg (norm_nonneg _) _)
      _ = 9 * ∑ k ∈ Finset.range m, ‖z‖ ^ k := by rw [Finset.mul_sum]
      _ < 9 * ‖z‖ ^ m := by have := geom_lt ‖z‖ (by linarith) m; linarith
  have e2 : ((f.coeff m : ℤ) : ℂ) * z ^ m + ((f.coeff (m + 1) : ℤ) : ℂ) * z ^ (m + 1)
      = -(∑ k ∈ Finset.range m, ((f.coeff k : ℤ) : ℂ) * z ^ k) := by
    linear_combination hsum
  rw [e2, norm_neg] at htop
  linarith

lemma prod_bound (s : Multiset ℂ) (hs : ∀ a ∈ s, 1 < ‖(10 : ℂ) - a‖) :
    1 ≤ ‖(s.map (fun a => (10 : ℂ) - a)).prod‖ ∧
      (s ≠ 0 → 1 < ‖(s.map (fun a => (10 : ℂ) - a)).prod‖) := by
  induction s using Multiset.induction_on with
  | empty => simp
  | cons a t ih =>
    have ha := hs a (Multiset.mem_cons_self a t)
    have ht := ih (fun b hb => hs b (Multiset.mem_cons_of_mem hb))
    rw [Multiset.map_cons, Multiset.prod_cons, norm_mul]
    constructor
    · nlinarith [ht.1]
    · intro _; nlinarith [ht.1]

lemma eval_gt_one (g : ℤ[X]) (hg : 1 ≤ g.natDegree)
    (hroots : ∀ z : ℂ, (g.map (Int.castRingHom ℂ)).eval z = 0 → 1 < ‖z - 10‖) :
    1 < |g.eval 10| := by
  set G := g.map (Int.castRingHom ℂ) with hG
  have hinj : Function.Injective (Int.castRingHom ℂ) := Int.cast_injective
  have hGdeg : G.natDegree = g.natDegree := natDegree_map_eq_of_injective hinj g
  have hGlead : G.leadingCoeff = (g.leadingCoeff : ℂ) := by
    rw [hG, leadingCoeff_map_of_injective hinj]; simp
  have hg0 : g ≠ 0 := by rintro rfl; simp at hg
  have hfact := C_leadingCoeff_mul_prod_multiset_X_sub_C
    (IsAlgClosed.card_roots_eq_natDegree (p := G))
  have heval : ((g.eval 10 : ℤ) : ℂ) = G.eval 10 := by
    have : (10 : ℂ) = (Int.castRingHom ℂ) 10 := by simp
    rw [hG, this, eval_map, eval₂_hom]
    simp
  have e : G.eval 10 = G.leadingCoeff * (G.roots.map (fun a => (10 : ℂ) - a)).prod := by
    conv_lhs => rw [← hfact]
    rw [eval_mul, eval_C, eval_multiset_prod, Multiset.map_map]
    congr 2
    apply Multiset.map_congr rfl
    intro a _
    simp
  have hrootsne : G.roots ≠ 0 := by
    intro h
    have := IsAlgClosed.card_roots_eq_natDegree (p := G)
    rw [h, hGdeg] at this
    simp at this
    omega
  have hpb := (prod_bound G.roots (fun a ha => by
    have := hroots a (isRoot_of_mem_roots ha)
    rwa [norm_sub_rev] at this)).2 hrootsne
  have hlc : (1 : ℝ) ≤ ‖(g.leadingCoeff : ℂ)‖ := by
    rw [Complex.norm_intCast]
    have := Int.one_le_abs (leadingCoeff_ne_zero.mpr hg0)
    exact_mod_cast this
  have h1 : 1 < ‖G.eval 10‖ := by
    rw [e, norm_mul, hGlead]
    nlinarith
  rw [← heval, Complex.norm_intCast] at h1
  exact_mod_cast h1

end P6

open P6 in
open Polynomial in
theorem problem6 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hf0 : f ≠ 0 := by
    rintro rfl
    simp at hp
  have key : ∀ g h : ℤ[X], f = g * h → IsUnit (g.eval 10) → IsUnit g := by
    intro g h hfgh hu
    by_cases hdeg : g.natDegree = 0
    · rw [eq_C_of_natDegree_eq_zero hdeg, eval_C] at hu
      rw [eq_C_of_natDegree_eq_zero hdeg]
      exact isUnit_C.mpr hu
    · exfalso
      have h1 : 1 < |g.eval 10| := by
        apply eval_gt_one g (by omega)
        intro z hz
        by_contra hle
        push_neg at hle
        apply root_bound f hdigit hf0 z hle
        rw [hfgh, Polynomial.map_mul, eval_mul, hz, zero_mul]
      rw [Int.isUnit_iff] at hu
      rcases hu with h | h <;> rw [h] at h1 <;> norm_num at h1
  rw [irreducible_iff]
  refine ⟨?_, ?_⟩
  · intro hu
    exact hp.not_unit (hu.map (Polynomial.evalRingHom 10))
  · intro g h hfgh
    have h10 : f.eval 10 = g.eval 10 * h.eval 10 := by rw [hfgh, eval_mul]
    rcases hp.irreducible.isUnit_or_isUnit h10 with hg | hh
    · left; exact key g h hfgh hg
    · right; exact key h g (by rw [hfgh, mul_comm]) hh
