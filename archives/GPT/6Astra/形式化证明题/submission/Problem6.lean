import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Algebra.Polynomial.Degree.Units
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.LinearCombination
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.Ring

open Polynomial

private lemma digit_sum_bound (f : ℤ[X])
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (z : ℂ) (hz : 9 ≤ ‖z‖) (k : ℕ) :
    ‖∑ i ∈ Finset.range k, (f.coeff i : ℂ) * z ^ i‖ ≤ 2 * ‖z‖ ^ k := by
  induction k with
  | zero => simp
  | succ k ih =>
    rw [Finset.sum_range_succ]
    have hc : ‖(f.coeff k : ℂ)‖ ≤ 9 := by
      rw [Complex.norm_intCast, abs_of_nonneg (show (0 : ℝ) ≤ f.coeff k by
        exact_mod_cast (hdigit k).1)]
      exact_mod_cast (hdigit k).2
    calc
      _ ≤ ‖∑ i ∈ Finset.range k, (f.coeff i : ℂ) * z ^ i‖ +
          ‖(f.coeff k : ℂ) * z ^ k‖ := norm_add_le _ _
      _ ≤ 2 * ‖z‖ ^ k + 9 * ‖z‖ ^ k := by
        rw [norm_mul, norm_pow]
        exact add_le_add ih (mul_le_mul_of_nonneg_right hc (by positivity))
      _ ≤ 2 * ‖z‖ ^ (k + 1) := by
        rw [pow_succ]
        nlinarith [pow_nonneg (norm_nonneg z) k]

private lemma digit_linear_bound (a b : ℤ) (ha : 1 ≤ a) (hb : 0 ≤ b)
    (z : ℂ) (hz : 0 ≤ z.re) :
    ‖z‖ ≤ ‖(a : ℂ) * z + b‖ := by
  have ha' : (1 : ℝ) ≤ a := by exact_mod_cast ha
  have hb' : (0 : ℝ) ≤ b := by exact_mod_cast hb
  rw [← sq_le_sq₀ (norm_nonneg _) (norm_nonneg _)]
  simp only [Complex.sq_norm, Complex.normSq_apply, Complex.add_re, Complex.mul_re,
    Complex.intCast_re, Complex.intCast_im, Complex.add_im, Complex.mul_im]
  nlinarith [sq_nonneg z.re, sq_nonneg z.im,
    mul_nonneg hz hb', mul_nonneg (sq_nonneg z.re) (show 0 ≤ (a : ℝ)^2 - 1 by nlinarith),
    mul_nonneg (sq_nonneg z.im) (show 0 ≤ (a : ℝ)^2 - 1 by nlinarith)]

private lemma digit_no_root (f : ℤ[X]) (hf : f ≠ 0)
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (z : ℂ) (hz : 9 ≤ ‖z‖) (hre : 0 ≤ z.re) : aeval z f ≠ 0 := by
  have hl : 1 ≤ f.coeff f.natDegree := by
    have := coeff_natDegree (p := f)
    have hn := leadingCoeff_ne_zero.mpr hf
    have := (hdigit f.natDegree).1
    change f.coeff f.natDegree ≠ 0 at hn
    omega
  intro he
  rw [aeval_eq_sum_range] at he
  simp only [zsmul_eq_mul] at he
  rcases hd : f.natDegree with _ | k
  · rw [hd] at hl he
    simp at he
    omega
  · rw [hd] at hl he
    have hid : (∑ i ∈ Finset.range k, (f.coeff i : ℂ) * z ^ i) +
        z ^ k * ((f.coeff (k + 1) : ℂ) * z + f.coeff k) = 0 := by
      simp only [Finset.sum_range_succ] at he
      convert he using 1 <;> ring
    have hid' : (∑ i ∈ Finset.range k, (f.coeff i : ℂ) * z ^ i) =
        -(z ^ k * ((f.coeff (k + 1) : ℂ) * z + f.coeff k)) := by
      linear_combination hid
    have hb := digit_sum_bound f hdigit z hz k
    rw [hid', norm_neg, norm_mul, norm_pow] at hb
    have hlin := digit_linear_bound _ _ hl (hdigit k).1 z hre
    have hpow : 0 < ‖z‖ ^ k := pow_pos (by linarith) _
    have hmul := mul_le_mul_of_nonneg_left hlin hpow.le
    nlinarith

private lemma digit_root_distance (f : ℤ[X]) (hf : f ≠ 0)
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (z : ℂ) (hz : aeval z f = 0) : 1 < ‖10 - z‖ := by
  by_contra! h
  have hn : 9 ≤ ‖z‖ := by
    have ht := norm_add_le (10 - z) z
    norm_num at ht
    linarith
  have hr : 0 ≤ z.re := by
    have ht := Complex.re_le_norm (10 - z)
    norm_num at ht
    linarith
  exact digit_no_root f hf hdigit z hn hr hz

private lemma unit_of_unit_eval (f g : ℤ[X]) (hf : f ≠ 0)
    (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hgf : g ∣ f) (hg : IsUnit (g.eval 10)) : IsUnit g := by
  have hg0 : g ≠ 0 := ne_zero_of_dvd_ne_zero hf hgf
  have hu : ‖((g.eval 10 : ℤ) : ℂ)‖ = 1 := by
    rcases Int.isUnit_eq_one_or hg with h | h <;> rw [h] <;> norm_num
  let G := g.map (algebraMap ℤ ℂ)
  have hG : G ≠ 0 := (Polynomial.map_ne_zero_iff (algebraMap ℤ ℂ).injective_int).mpr hg0
  have hsplit : G.Splits := IsAlgClosed.splits G
  have hroot : ∀ z ∈ G.roots, 1 < ‖(10 : ℂ) - z‖ := by
    intro z hz
    have hz' : aeval z g = 0 := by
      simpa only [G, IsRoot.def, eval_map_algebraMap] using isRoot_of_mem_roots hz
    apply digit_root_distance f hf hdigit z
    obtain ⟨h, rfl⟩ := hgf
    rw [map_mul, hz', zero_mul]
  have hlead : (1 : ℝ) ≤ ‖G.leadingCoeff‖ := by
    rw [show G.leadingCoeff = (g.leadingCoeff : ℂ) by
      exact leadingCoeff_map_of_injective (algebraMap ℤ ℂ).injective_int g,
      Complex.norm_intCast, ← Int.cast_abs]
    exact_mod_cast (show (1 : ℤ) ≤ |g.leadingCoeff| from
      Int.one_le_abs (leadingCoeff_ne_zero.mpr hg0))
  have hev : ‖G.eval 10‖ = 1 := by
    have hec : G.eval (10 : ℂ) = ((g.eval (10 : ℤ) : ℤ) : ℂ) := by
      rw [show G = g.map (algebraMap ℤ ℂ) from rfl, eval_map]
      simpa using (eval₂_at_apply (p := g) (algebraMap ℤ ℂ) (10 : ℤ))
    rw [hec]
    exact hu
  have hdeg : g.natDegree = 0 := by
    by_contra hn
    have hroots : G.roots ≠ 0 := by
      intro he
      have hc := hsplit.natDegree_eq_card_roots
      rw [he, Multiset.card_zero] at hc
      exact hn ((natDegree_map_eq_of_injective (algebraMap ℤ ℂ).injective_int g).symm.trans hc)
    have hprod : 1 < (G.roots.map (fun z => ‖(10 : ℂ) - z‖)).prod := by
      simpa using Multiset.prod_map_lt_prod_map hroots (fun _ => (1 : ℝ))
        (fun z => ‖(10 : ℂ) - z‖) (by intros; norm_num) hroot
    rw [hsplit.eval_eq_prod_roots, norm_mul, Multiset.norm_prod, Multiset.map_map] at hev
    have := mul_le_mul_of_nonneg_right hlead (le_of_lt (lt_trans (by norm_num) hprod))
    dsimp [Function.comp_def] at hev
    nlinarith
  rw [eq_C_of_natDegree_eq_zero hdeg, eval_C] at hg
  rw [eq_C_of_natDegree_eq_zero hdeg]
  exact hg.map C

open Polynomial in
theorem problem6 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hf : f ≠ 0 := by
    intro h
    apply hp.ne_zero
    simp [h]
  refine ⟨fun h => hp.not_isUnit (h.map (evalRingHom 10)), ?_⟩
  intro g h he
  have heval : f.eval 10 = g.eval 10 * h.eval 10 := by rw [he, eval_mul]
  rcases hp.irreducible.isUnit_or_isUnit heval with hg | hh
  · exact Or.inl (unit_of_unit_eval f g hf hdigit ⟨h, he⟩ hg)
  · exact Or.inr (unit_of_unit_eval f h hf hdigit ⟨g, by rw [mul_comm, ← he]⟩ hh)
