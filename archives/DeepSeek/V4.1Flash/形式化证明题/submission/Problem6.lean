import Mathlib.Analysis.Complex.Polynomial.Basic
import Mathlib.Algebra.Polynomial.Splits
import Mathlib.Tactic

open Polynomial

namespace Cohn

lemma geom_sub_mul (x y : ℂ) (n : ℕ) :
    (x - y) * ∑ k ∈ Finset.range (n + 1), x ^ k * y ^ (n - k) = x ^ (n + 1) - y ^ (n + 1) := by
  induction n with
  | zero => simp
  | succ n ih =>
    rw [Finset.sum_range_succ]
    have h2 : ∑ k ∈ Finset.range (n + 1), x ^ k * y ^ (n + 1 - k) =
        y * ∑ k ∈ Finset.range (n + 1), x ^ k * y ^ (n - k) := by
      rw [Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro k hk
      rw [Finset.mem_range] at hk
      have hk' : n + 1 - k = (n - k) + 1 := by omega
      rw [hk', pow_succ']
      ring
    rw [h2]
    simp
    have : (x - y) * (y * ∑ k ∈ Finset.range (n + 1), x ^ k * y ^ (n - k) + x ^ (n + 1)) =
        y * ((x - y) * ∑ k ∈ Finset.range (n + 1), x ^ k * y ^ (n - k)) + (x - y) * x ^ (n + 1) := by
      ring
    rw [this, ih]
    ring

lemma geom_sub_mul' (x y : ℂ) (n : ℕ) :
    (x - y) * ∑ k ∈ Finset.range n, x ^ k * y ^ (n - 1 - k) = x ^ n - y ^ n := by
  cases n with
  | zero => simp
  | succ m => simpa [Nat.add_sub_cancel] using geom_sub_mul x y m

lemma geom_bound (r : ℝ) (hr0 : 0 ≤ r) (hr1 : r < 1) (n : ℕ) :
    ∑ j ∈ Finset.range n, r ^ j ≤ 1 / (1 - r) := by
  have hpos : (0 : ℝ) < 1 - r := by linarith
  have h := mul_geom_sum r n
  have h1 : (∑ j ∈ Finset.range n, r ^ j) * (1 - r) = 1 - r ^ n := by nlinarith [h]
  have h2 : (∑ j ∈ Finset.range n, r ^ j) * (1 - r) ≤ (1 / (1 - r)) * (1 - r) := by
    rw [h1]
    have h3 : (1 / (1 - r)) * (1 - r) = 1 := by field_simp
    rw [h3]
    have h4 : (0 : ℝ) ≤ r ^ n := pow_nonneg hr0 n
    linarith
  exact le_of_mul_le_mul_right h2 hpos

noncomputable def rev (f : ℤ[X]) (t : ℂ) : ℂ :=
  ∑ j ∈ Finset.range (f.natDegree + 1), (f.coeff (f.natDegree - j) : ℂ) * t ^ j

lemma sum_rev_eq (g : ℕ → ℂ) (m : ℕ) :
    ∑ j ∈ Finset.range (m + 1), g (m - j) = ∑ i ∈ Finset.range (m + 1), g i := by
  have h := Finset.sum_range_reflect g (m + 1)
  simpa using h

lemma pow_mul_inv_pow {α : ℂ} (hα : α ≠ 0) {j m : ℕ} (hj : j ≤ m) :
    α ^ m * α⁻¹ ^ j = α ^ (m - j) := by
  rw [inv_pow, ← pow_sub₀ α hα hj]

lemma eval_map_intCast (f : ℤ[X]) (x : ℤ) :
    (f.map (Int.castRingHom ℂ)).eval ((x : ℤ) : ℂ) = ((f.eval x : ℤ) : ℂ) :=
  Polynomial.eval_map_apply (p := f) (Int.castRingHom ℂ) x

lemma rev_mul_pow_eq_eval (f : ℤ[X]) {α : ℂ} (hα : α ≠ 0) :
    α ^ f.natDegree * rev f α⁻¹ = (f.map (Int.castRingHom ℂ)).eval α := by
  have hmem : ∀ j ∈ Finset.range (f.natDegree + 1), j ≤ f.natDegree := by
    intro j hj
    simp only [Finset.mem_range] at hj
    omega
  calc α ^ f.natDegree * rev f α⁻¹
      = ∑ j ∈ Finset.range (f.natDegree + 1),
          α ^ f.natDegree * ((f.coeff (f.natDegree - j) : ℂ) * (α⁻¹) ^ j) := by
        rw [rev, Finset.mul_sum]
    _ = ∑ j ∈ Finset.range (f.natDegree + 1),
          (f.coeff (f.natDegree - j) : ℂ) * α ^ (f.natDegree - j) := by
        apply Finset.sum_congr rfl
        intro j hj
        have hid : α ^ f.natDegree * (α⁻¹) ^ j = α ^ (f.natDegree - j) :=
          pow_mul_inv_pow hα (hmem j hj)
        rw [← hid]
        ring
    _ = ∑ i ∈ Finset.range (f.natDegree + 1), (f.coeff i : ℂ) * α ^ i :=
        sum_rev_eq (fun i => (f.coeff i : ℂ) * α ^ i) f.natDegree
    _ = (f.map (Int.castRingHom ℂ)).eval α := by
        rw [eval_eq_sum_range,
          natDegree_map_eq_of_injective (f := Int.castRingHom ℂ) (Int.cast_injective) f]
        apply Finset.sum_congr rfl
        intro i hi
        rw [coeff_map]
        simp

lemma rev_ten (f : ℤ[X]) :
    (10 : ℂ) ^ f.natDegree * rev f ((10 : ℂ)⁻¹) = ((f.eval 10 : ℤ) : ℂ) := by
  rw [rev_mul_pow_eq_eval f (by norm_num : (10:ℂ) ≠ 0)]
  exact eval_map_intCast f (10:ℤ)

lemma rev_diff_eq (f : ℤ[X]) (α : ℂ) :
    rev f ((10 : ℂ)⁻¹) - rev f α⁻¹ = ((10 : ℂ)⁻¹ - α⁻¹) *
      ∑ j ∈ Finset.range (f.natDegree + 1),
        (f.coeff (f.natDegree - j) : ℂ) *
          ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k) := by
  rw [rev, rev, ← Finset.sum_sub_distrib, Finset.mul_sum]
  apply Finset.sum_congr rfl
  intro j hj
  have h := geom_sub_mul' ((10 : ℂ)⁻¹) (α⁻¹) j
  calc (f.coeff (f.natDegree - j) : ℂ) * (10 : ℂ)⁻¹ ^ j -
        (f.coeff (f.natDegree - j) : ℂ) * α⁻¹ ^ j
      = (f.coeff (f.natDegree - j) : ℂ) * (((10 : ℂ)⁻¹) ^ j - (α⁻¹) ^ j) := by ring
    _ = (f.coeff (f.natDegree - j) : ℂ) *
          (((10 : ℂ)⁻¹ - α⁻¹) *
            ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)) := by rw [h]
    _ = ((10 : ℂ)⁻¹ - α⁻¹) *
          ((f.coeff (f.natDegree - j) : ℂ) *
            ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)) := by ring

lemma norm_inv_sub_inv_ten {α : ℂ} (hα : 9 ≤ ‖α‖) (hα10 : ‖α - 10‖ ≤ 1) :
    ‖(10 : ℂ)⁻¹ - α⁻¹‖ ≤ 1 / 90 := by
  have hα0 : α ≠ 0 := by
    intro h
    rw [h] at hα
    norm_num at hα
  have heq : (10 : ℂ)⁻¹ - α⁻¹ = (α - 10) * ((10 : ℂ) * α)⁻¹ := by
    field_simp
  rw [heq, norm_mul, norm_inv, norm_mul]
  have h10n : ‖(10 : ℂ)‖ = 10 := by norm_num
  rw [h10n]
  have hprod : (0 : ℝ) < 10 * 9 := by norm_num
  have hle1 : (10 : ℝ) * 9 ≤ 10 * ‖α‖ := by linarith
  have hinv : (10 * ‖α‖)⁻¹ ≤ (10 * 9)⁻¹ := inv_anti₀ hprod hle1
  calc ‖α - 10‖ * (10 * ‖α‖)⁻¹ ≤ 1 * (10 * 9)⁻¹ := by
        apply mul_le_mul hα10 hinv (by positivity) (by norm_num)
    _ = 1 / 90 := by norm_num

lemma rev_diff_bound (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    {α : ℂ} (hα : 9 ≤ ‖α‖) (hα10 : ‖α - 10‖ ≤ 1) :
    ‖rev f ((10 : ℂ)⁻¹) - rev f α⁻¹‖ ≤ 9 / 70 := by
  rw [rev_diff_eq]
  have hst : ‖(10 : ℂ)⁻¹ - α⁻¹‖ ≤ 1 / 90 := norm_inv_sub_inv_ten hα hα10
  have hs : ‖(10 : ℂ)⁻¹‖ ≤ 1 / 9 := by
    rw [norm_inv]
    norm_num
  have ht : ‖α⁻¹‖ ≤ 1 / 9 := by
    rw [norm_inv]
    simpa using inv_anti₀ (by norm_num : (0:ℝ) < 9) hα
  have hinner : ∀ j : ℕ,
      ‖∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ ≤
        (j : ℝ) * (1 / 9) ^ (j - 1) := by
    intro j
    have h1 : ‖∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ ≤
        ∑ k ∈ Finset.range j, ‖((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ :=
      norm_sum_le _ _
    have h2 : ∑ k ∈ Finset.range j, ‖((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ ≤
        ∑ k ∈ Finset.range j, (1 / 9 : ℝ) ^ k * (1 / 9 : ℝ) ^ (j - 1 - k) := by
      apply Finset.sum_le_sum
      intro k hk
      rw [norm_mul, norm_pow, norm_pow]
      exact mul_le_mul (pow_le_pow_left₀ (norm_nonneg _) hs k)
        (pow_le_pow_left₀ (norm_nonneg _) ht (j - 1 - k)) (by positivity) (by positivity)
    have h3 : ∑ k ∈ Finset.range j, (1 / 9 : ℝ) ^ k * (1 / 9 : ℝ) ^ (j - 1 - k) =
        (j : ℝ) * (1 / 9 : ℝ) ^ (j - 1) := by
      have : ∀ k ∈ Finset.range j, (1 / 9 : ℝ) ^ k * (1 / 9 : ℝ) ^ (j - 1 - k) =
          (1 / 9 : ℝ) ^ (j - 1) := by
        intro k hk
        rw [Finset.mem_range] at hk
        rw [← pow_add]
        congr 1
        omega
      rw [Finset.sum_congr rfl this, Finset.sum_const, Finset.card_range, nsmul_eq_mul]
    linarith [h1, h2, h3]
  have hcoeff : ∀ j : ℕ, ‖(f.coeff (f.natDegree - j) : ℂ)‖ ≤ 9 := by
    intro j
    rw [Complex.norm_intCast]
    have h := (hdigit (f.natDegree - j))
    have h1 : (0:ℝ) ≤ ((f.coeff (f.natDegree - j) : ℤ) : ℝ) := by exact_mod_cast h.1
    have h2 : ((f.coeff (f.natDegree - j) : ℤ) : ℝ) ≤ 9 := by exact_mod_cast h.2
    rw [abs_le]
    constructor <;> linarith
  have hterm : ∀ j ∈ Finset.range (f.natDegree + 1),
      ‖(f.coeff (f.natDegree - j) : ℂ) *
        ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ ≤
        9 * ((j : ℝ) * (1 / 9) ^ (j - 1)) := by
    intro j hj
    rw [norm_mul]
    have h2 := hinner j
    have h1 := mul_le_mul_of_nonneg_left h2 (norm_nonneg (f.coeff (f.natDegree - j) : ℂ))
    have h3 : ‖(f.coeff (f.natDegree - j) : ℂ)‖ * ((j : ℝ) * (1 / 9) ^ (j - 1)) ≤
        9 * ((j : ℝ) * (1 / 9) ^ (j - 1)) := by
      apply mul_le_mul_of_nonneg_right (hcoeff j) (by positivity)
    linarith [h1, h3]
  have hgeom : ∑ j ∈ Finset.range (f.natDegree + 1), (j : ℝ) * (1 / 9) ^ (j - 1) ≤ 9 / 7 := by
    have hshift : ∑ j ∈ Finset.range (f.natDegree + 1), (j : ℝ) * (1 / 9 : ℝ) ^ (j - 1) =
        ∑ i ∈ Finset.range f.natDegree, ((i + 1 : ℕ) : ℝ) * (1 / 9 : ℝ) ^ i := by
      rw [Finset.sum_range_succ']
      simp
    rw [hshift]
    have hterm2 : ∀ i : ℕ, ((i + 1 : ℕ) : ℝ) * (1 / 9 : ℝ) ^ i ≤ (2 / 9 : ℝ) ^ i := by
      intro i
      have h1 : ((i + 1 : ℕ) : ℝ) ≤ (2 : ℝ) ^ i := by
        have := Nat.lt_two_pow_self (n := i)
        have : i + 1 ≤ 2 ^ i := by omega
        exact_mod_cast this
      calc ((i + 1 : ℕ) : ℝ) * (1 / 9 : ℝ) ^ i ≤ (2 : ℝ) ^ i * (1 / 9 : ℝ) ^ i := by
            apply mul_le_mul_of_nonneg_right h1 (by positivity)
        _ = (2 / 9 : ℝ) ^ i := by rw [← mul_pow]; norm_num
    calc ∑ i ∈ Finset.range f.natDegree, ((i + 1 : ℕ) : ℝ) * (1 / 9 : ℝ) ^ i
        ≤ ∑ i ∈ Finset.range f.natDegree, (2 / 9 : ℝ) ^ i :=
          Finset.sum_le_sum (fun i _ => hterm2 i)
      _ ≤ 1 / (1 - 2 / 9) := geom_bound (2 / 9) (by norm_num) (by norm_num) _
      _ = 9 / 7 := by norm_num
  have hW : ‖∑ j ∈ Finset.range (f.natDegree + 1),
        (f.coeff (f.natDegree - j) : ℂ) *
          ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ ≤
        ∑ j ∈ Finset.range (f.natDegree + 1), 9 * ((j : ℝ) * (1 / 9) ^ (j - 1)) := by
    calc ‖∑ j ∈ Finset.range (f.natDegree + 1),
          (f.coeff (f.natDegree - j) : ℂ) *
            ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖
        ≤ ∑ j ∈ Finset.range (f.natDegree + 1),
            ‖(f.coeff (f.natDegree - j) : ℂ) *
              ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ :=
          norm_sum_le _ _
      _ ≤ ∑ j ∈ Finset.range (f.natDegree + 1), 9 * ((j : ℝ) * (1 / 9) ^ (j - 1)) :=
          Finset.sum_le_sum hterm
  have hW2 : ∑ j ∈ Finset.range (f.natDegree + 1), 9 * ((j : ℝ) * (1 / 9) ^ (j - 1)) ≤ 81 / 7 := by
    rw [← Finset.mul_sum]
    have : ∑ j ∈ Finset.range (f.natDegree + 1), (j : ℝ) * (1 / 9 : ℝ) ^ (j - 1) ≤ 9 / 7 := hgeom
    nlinarith
  calc ‖((10 : ℂ)⁻¹ - α⁻¹) *
        ∑ j ∈ Finset.range (f.natDegree + 1),
          (f.coeff (f.natDegree - j) : ℂ) *
            ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖
      = ‖(10 : ℂ)⁻¹ - α⁻¹‖ *
        ‖∑ j ∈ Finset.range (f.natDegree + 1),
          (f.coeff (f.natDegree - j) : ℂ) *
            ∑ k ∈ Finset.range j, ((10 : ℂ)⁻¹) ^ k * (α⁻¹) ^ (j - 1 - k)‖ := norm_mul _ _
    _ ≤ (1 / 90) * (81 / 7) := by
        apply mul_le_mul hst (le_trans hW hW2) (norm_nonneg _) (by norm_num)
    _ = 9 / 70 := by norm_num



lemma ten_pow_le_eval (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hf : f ≠ 0) : (10 : ℤ) ^ f.natDegree ≤ f.eval 10 := by
  have hcoeff : 1 ≤ f.coeff f.natDegree := by
    have h0 := (hdigit f.natDegree).1
    have hne : f.coeff f.natDegree ≠ 0 := by
      rw [coeff_natDegree]
      exact leadingCoeff_ne_zero.mpr hf
    omega
  rw [eval_eq_sum_range]
  have hterm : ∀ i ∈ Finset.range (f.natDegree + 1), 0 ≤ f.coeff i * 10 ^ i := by
    intro i hi
    exact mul_nonneg (hdigit i).1 (by positivity)
  have hsingle : f.coeff f.natDegree * 10 ^ f.natDegree ≤
      ∑ i ∈ Finset.range (f.natDegree + 1), f.coeff i * 10 ^ i :=
    Finset.single_le_sum hterm (Finset.self_mem_range_succ _)
  have h2 : (10 : ℤ) ^ f.natDegree ≤ f.coeff f.natDegree * 10 ^ f.natDegree := by
    have hpos : (0 : ℤ) < 10 ^ f.natDegree := pow_pos (by norm_num) _
    nlinarith
  linarith

lemma no_root_near (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hf : f ≠ 0) (hm : 1 ≤ f.natDegree) {α : ℂ}
    (hroot : (f.map (Int.castRingHom ℂ)).eval α = 0) : 1 < ‖α - 10‖ := by
  by_contra hle
  push_neg at hle
  have hα9 : 9 ≤ ‖α‖ := by
    have h := abs_norm_sub_norm_le α (10 : ℂ)
    have h10 : ‖(10 : ℂ)‖ = 10 := by norm_num
    rw [h10, abs_le] at h
    linarith [h.1, hle]
  have hα0 : α ≠ 0 := by
    intro h
    rw [h] at hα9
    norm_num at hα9
  have hrev0 : rev f α⁻¹ = 0 := by
    have h := rev_mul_pow_eq_eval f hα0
    rw [hroot, mul_eq_zero] at h
    exact h.resolve_left (pow_ne_zero _ hα0)
  have hlow : 1 ≤ ‖rev f ((10 : ℂ)⁻¹)‖ := by
    have hbase : (10 : ℝ) ^ f.natDegree ≤ ((f.eval 10 : ℤ) : ℝ) := by
      have h := ten_pow_le_eval f hdigit hf
      exact_mod_cast h
    have h2 : ‖rev f ((10 : ℂ)⁻¹)‖ = ((f.eval 10 : ℤ) : ℝ) / (10 : ℝ) ^ f.natDegree := by
      have h := congrArg norm (rev_ten f)
      rw [norm_mul, norm_pow, Complex.norm_intCast] at h
      have h10 : ‖(10 : ℂ)‖ = 10 := by norm_num
      rw [h10] at h
      have heval_nn : (0 : ℝ) ≤ ((f.eval 10 : ℤ) : ℝ) := by
        have hp10 : (0 : ℝ) ≤ (10 : ℝ) ^ f.natDegree := by positivity
        linarith
      rw [abs_of_nonneg heval_nn] at h
      rw [eq_div_iff (by positivity)]
      linarith [h]
    rw [h2, le_div_iff₀ (by positivity)]
    linarith [hbase]
  have hup : ‖rev f ((10 : ℂ)⁻¹) - rev f α⁻¹‖ ≤ 9 / 70 := rev_diff_bound f hdigit hα9 hle
  rw [hrev0, sub_zero] at hup
  linarith

lemma multiset_prod_one_lt (s : Multiset ℂ) (hs : s ≠ 0) (h : ∀ a ∈ s, 1 < ‖a‖) :
    1 < ‖s.prod‖ := by
  induction s using Multiset.induction with
  | empty => exact absurd rfl hs
  | cons a t ih =>
    rw [Multiset.prod_cons, norm_mul]
    by_cases ht : t = 0
    · rw [ht, Multiset.prod_zero, norm_one, mul_one]
      exact h a (Multiset.mem_cons_self a t)
    · have h1 : 1 < ‖a‖ := h a (Multiset.mem_cons_self a t)
      have h2 : 1 < ‖t.prod‖ := ih ht (fun b hb => h b (Multiset.mem_cons_of_mem hb))
      nlinarith [norm_nonneg a, norm_nonneg t.prod]

lemma key (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : f.eval 10 ≠ 0) (g : ℤ[X]) (hg : g ∣ f) (hgn : g.natDegree ≠ 0) :
    ‖((g.eval 10 : ℤ) : ℂ)‖ ≠ 1 := by
  intro hgnorm
  have hf : f ≠ 0 := by
    intro h
    exact hp (by rw [h]; simp)
  obtain ⟨q, hq⟩ := hg
  have hg0 : g ≠ 0 := by
    intro h
    exact hgn (by rw [h]; simp)
  have hq0 : q ≠ 0 := by
    intro h
    exact hf (by rw [hq, h, mul_zero])
  have hf1 : 1 ≤ f.natDegree := by
    rw [hq, natDegree_mul hg0 hq0]
    have : 1 ≤ g.natDegree := Nat.one_le_iff_ne_zero.mpr hgn
    omega
  set G : ℂ[X] := g.map (Int.castRingHom ℂ) with hGdef
  have hGnd : G.natDegree = g.natDegree := by
    rw [hGdef]
    exact natDegree_map_eq_of_injective (f := Int.castRingHom ℂ) Int.cast_injective g
  have hG0 : G ≠ 0 := by
    intro h
    rw [h] at hGnd
    simp at hGnd
    omega
  have hsplit : G.Splits := IsAlgClosed.splits G
  have hcard : G.natDegree = G.roots.card := hsplit.natDegree_eq_card_roots
  have hroots_ne : G.roots ≠ 0 := by
    intro h
    rw [h] at hcard
    simp at hcard
    omega
  have heval : G.eval (10 : ℂ) = G.leadingCoeff *
      (G.roots.map (fun a => (10 : ℂ) - a)).prod := hsplit.eval_eq_prod_roots 10
  have hevalnorm : ‖G.eval (10 : ℂ)‖ = 1 := by
    rw [hGdef]
    have h := eval_map_intCast g 10
    have h2 : (g.map (Int.castRingHom ℂ)).eval (10 : ℂ) = ((g.eval 10 : ℤ) : ℂ) := by
      simpa using h
    rw [h2]
    exact hgnorm
  have hlead_eq : ‖G.leadingCoeff‖ = |((g.leadingCoeff : ℤ) : ℝ)| := by
    have h1 : G.leadingCoeff = ((g.leadingCoeff : ℤ) : ℂ) := by
      rw [← coeff_natDegree (p := G), hGnd, hGdef, coeff_map, coeff_natDegree]
      rfl
    rw [h1, Complex.norm_intCast]
  have hlead : 1 ≤ ‖G.leadingCoeff‖ := by
    rw [hlead_eq]
    have h : g.leadingCoeff ≠ 0 := leadingCoeff_ne_zero.mpr hg0
    have h' := Int.one_le_abs h
    exact_mod_cast h'
  have hnear : ∃ a ∈ G.roots, ‖(10 : ℂ) - a‖ ≤ 1 := by
    by_contra hcon
    push_neg at hcon
    have hprod : 1 < ‖(G.roots.map (fun a => (10 : ℂ) - a)).prod‖ := by
      apply multiset_prod_one_lt
      · rw [Ne, Multiset.map_eq_zero]
        exact hroots_ne
      · intro b hb
        rw [Multiset.mem_map] at hb
        obtain ⟨a, ha, rfl⟩ := hb
        exact hcon a ha
    have he := congrArg norm heval
    rw [norm_mul] at he
    nlinarith [he, hevalnorm, hprod, hlead]
  obtain ⟨a, ha, hna⟩ := hnear
  have hGa : G.eval a = 0 := by
    have h := (Polynomial.mem_roots hG0).mp ha
    rwa [Polynomial.IsRoot.def] at h
  have hFa : (f.map (Int.castRingHom ℂ)).eval a = 0 := by
    have hfeq : f.map (Int.castRingHom ℂ) = G * q.map (Int.castRingHom ℂ) := by
      rw [hq, Polynomial.map_mul, hGdef]
    rw [hfeq, eval_mul, hGa, zero_mul]
  have hcontra := no_root_near f hdigit hf hf1 hFa
  rw [norm_sub_rev] at hna
  linarith

lemma const_of_unit_eval (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : f.eval 10 ≠ 0) (g : ℤ[X]) (hg : g ∣ f) (hu : IsUnit (g.eval 10)) :
    IsUnit g := by
  by_cases hdeg : g.natDegree = 0
  · have hgC : g = C (g.coeff 0) := eq_C_of_natDegree_eq_zero hdeg
    have hev : g.coeff 0 = g.eval 10 := by
      rw [hgC, eval_C]
      simp
    rw [hgC, hev]
    exact isUnit_C.mpr hu
  · exfalso
    have hnorm : ‖((g.eval 10 : ℤ) : ℂ)‖ = 1 := by
      rcases Int.isUnit_iff.mp hu with h | h
      · rw [h]; norm_num
      · rw [h]; norm_num
    exact key f hdigit hp g hg hdeg hnorm

lemma problem6_aux (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hp_ne : f.eval 10 ≠ 0 := hp.ne_zero
  rw [irreducible_iff]
  constructor
  · intro hunit
    have h2 : IsUnit (f.eval 10) := hunit.map (Polynomial.evalRingHom (10 : ℤ))
    exact hp.not_isUnit h2
  · intro a b hab
    have h : f.eval 10 = a.eval 10 * b.eval 10 := by
      rw [← eval_mul, ← hab]
    rcases hp.irreducible.2 h with hua | hub
    · left
      exact const_of_unit_eval f hdigit hp_ne a ⟨b, hab⟩ hua
    · right
      exact const_of_unit_eval f hdigit hp_ne b ⟨a, by rw [hab, mul_comm]⟩ hub



end Cohn

open Polynomial in
theorem problem6 (f : ℤ[X]) (hdigit : ∀ n, 0 ≤ f.coeff n ∧ f.coeff n ≤ 9)
    (hp : Prime (f.eval 10)) : Irreducible f := by
  have hp_ne : f.eval 10 ≠ 0 := hp.ne_zero
  rw [irreducible_iff]
  constructor
  · intro hunit
    have h2 : IsUnit (f.eval 10) := hunit.map (Polynomial.evalRingHom (10 : ℤ))
    exact hp.not_isUnit h2
  · intro a b hab
    have h : f.eval 10 = a.eval 10 * b.eval 10 := by
      rw [← eval_mul, ← hab]
    rcases hp.irreducible.2 h with hua | hub
    · left
      exact Cohn.const_of_unit_eval f hdigit hp_ne a ⟨b, hab⟩ hua
    · right
      exact Cohn.const_of_unit_eval f hdigit hp_ne b ⟨a, by rw [hab, mul_comm]⟩ hub