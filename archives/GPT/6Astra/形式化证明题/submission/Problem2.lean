import Mathlib.LinearAlgebra.Lagrange
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.Data.Nat.Choose.Dvd
import Mathlib.Data.Set.Card
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.Ring

open Polynomial Finset

private lemma small_moment_indices (p d : ℕ) (hp : p.Prime) (hp2 : 2 < p)
    (hd : 2 ≤ d) (hdp : d < p) :
    ∃ k l : ℕ, 0 < k ∧ k * d + l = p - 1 ∧ 2 * (k + l) ≤ p - 1 := by
  let k := (p - 1) / d
  let l := (p - 1) % d
  have hk : 0 < k := Nat.div_pos (by omega) (by omega)
  have hl : l < d := Nat.mod_lt _ (by omega)
  have he : k * d + l = p - 1 := by
    simpa [k, l, Nat.mul_comm, Nat.add_comm] using Nat.mod_add_div (p - 1) d
  have ho : p % 2 = 1 := Nat.odd_iff.mp (hp.odd_of_ne_two (by omega))
  refine ⟨k, l, hk, he, ?_⟩
  by_cases hk1 : k = 1
  · rw [hk1, one_mul] at he
    omega
  by_cases hd2 : d = 2
  · subst d
    omega
  have hk2 : 2 ≤ k := by omega
  have hd3 : 3 ≤ d := by omega
  have hmul := Nat.mul_le_mul_right (d - 2) hk2
  have hsub : d - 2 + 2 = d := by omega
  nlinarith

private noncomputable def momentPolynomial {p : ℕ} [Fact p.Prime]
    (f : ZMod p → ZMod p) (n : ℕ) :
    (ZMod p)[X] :=
  ∑ j ∈ Finset.range n, monomial j
    ((n.choose j : ZMod p) * ∑ x : ZMod p, x ^ j * (f x) ^ (n - j))

private lemma moment_coeff {p : ℕ} [Fact p.Prime] (f : ZMod p → ZMod p)
    (n j : ℕ) (hj : j < n) :
    (momentPolynomial f n).coeff j =
      (n.choose j : ZMod p) * ∑ x : ZMod p, x ^ j * (f x) ^ (n - j) := by
  classical
  simp [momentPolynomial, coeff_monomial, Finset.sum_ite_eq', hj]

private lemma moment_degree {p : ℕ} [Fact p.Prime] (f : ZMod p → ZMod p)
    (n : ℕ) : (momentPolynomial f n).natDegree ≤ n - 1 := by
  apply natDegree_sum_le_of_forall_le
  intro j hj
  exact (natDegree_monomial_le _).trans (by have := Finset.mem_range.mp hj; omega)

private lemma moment_eval {p : ℕ} [Fact p.Prime] (f : ZMod p → ZMod p)
    (n : ℕ) (hn : n < p - 1) (t : ZMod p) :
    (momentPolynomial f n).eval t = ∑ x : ZMod p, (t * x + f x) ^ n := by
  classical
  have hs : (∑ x : ZMod p, x ^ n) = 0 := by
    apply FiniteField.sum_pow_lt_card_sub_one
    simpa using hn
  have hex : (∑ x : ZMod p, (t * x + f x) ^ n) =
      ∑ j ∈ Finset.range (n + 1),
        ((n.choose j : ZMod p) * ∑ x : ZMod p, x ^ j * (f x) ^ (n - j)) * t ^ j := by
    simp only [add_pow, mul_pow]
    rw [Finset.sum_comm]
    apply Finset.sum_congr rfl
    intro j hj
    rw [Finset.mul_sum, Finset.sum_mul]
    apply Finset.sum_congr rfl
    intro x hx
    ring
  rw [hex, Finset.sum_range_succ]
  simp only [Nat.choose_self, Nat.sub_self, pow_zero, mul_one, hs, mul_zero, zero_mul, add_zero]
  simp only [momentPolynomial, eval_finsetSum, eval_monomial]

private lemma sum_top_power {p : ℕ} [Fact p.Prime] :
    (∑ x : ZMod p, x ^ (p - 1)) = -1 := by
  classical
  have hp := (Fact.out : p.Prime)
  rw [← Finset.sum_erase_add _ _ (Finset.mem_univ (0 : ZMod p))]
  have he : (∑ x ∈ (Finset.univ.erase (0 : ZMod p)), x ^ (p - 1)) =
      ∑ x ∈ (Finset.univ.erase (0 : ZMod p)), (1 : ZMod p) := by
    apply Finset.sum_congr rfl
    intro x hx
    exact ZMod.pow_card_sub_one_eq_one (Finset.mem_erase.mp hx).1
  rw [he]
  simp [Nat.sub_ne_zero_of_lt hp.one_lt, Finset.card_erase_of_mem,
    Nat.cast_sub hp.one_lt.le, ZMod.card]

private lemma sum_eval_top_degree {p : ℕ} [Fact p.Prime] (P : (ZMod p)[X])
    (hP : P.natDegree = p - 1) : (∑ x : ZMod p, P.eval x) = -P.leadingCoeff := by
  classical
  simp only [eval_eq_sum_range, hP]
  rw [Finset.sum_comm, Finset.sum_range_succ]
  have hlow : (∑ i ∈ Finset.range (p - 1), ∑ x : ZMod p, P.coeff i * x ^ i) = 0 := by
    apply Finset.sum_eq_zero
    intro i hi
    rw [← Finset.mul_sum]
    have hh : (∑ x : ZMod p, x ^ i) = 0 := by
      apply FiniteField.sum_pow_lt_card_sub_one
      simpa using Finset.mem_range.mp hi
    rw [hh, mul_zero]
  rw [hlow, zero_add, ← Finset.mul_sum, sum_top_power, mul_neg_one, ← hP, coeff_natDegree]

private lemma nonzero_small_moment (p : ℕ) [Fact p.Prime] (hp2 : 2 < p)
    (f : ZMod p → ZMod p) (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    ∃ n : ℕ, 0 < n ∧ 2 * n ≤ p - 1 ∧ momentPolynomial f n ≠ 0 := by
  classical
  let P : (ZMod p)[X] := Lagrange.interpolate Finset.univ (fun x : ZMod p => x) f
  have hPeval : ∀ x, P.eval x = f x := by
    intro x
    exact Lagrange.eval_interpolate_at_node f (fun _ _ _ _ h => h) (Finset.mem_univ x)
  have hPdeg : P.natDegree < p := by
    by_cases hPzero : P = 0
    · simp [hPzero]; omega
    have hh := Lagrange.degree_interpolate_lt f
      (s := (Finset.univ : Finset (ZMod p))) (v := fun x => x) (fun _ _ _ _ h => h)
    apply (natDegree_lt_iff_degree_lt hPzero).mpr
    simpa [P] using hh
  have hP2 : 2 ≤ P.natDegree := by
    by_contra hh
    obtain ⟨a, b, hab⟩ := exists_eq_X_add_C_of_natDegree_le_one (p := P) (by omega)
    apply hf
    refine ⟨a, b, fun x => ?_⟩
    rw [← hPeval x, hab]
    simp
  have hP0 : P ≠ 0 := by intro he; simp [he] at hP2
  obtain ⟨k, l, hk, hkl, hsmall⟩ := small_moment_indices p P.natDegree Fact.out hp2 hP2 hPdeg
  let n := k + l
  have hn : 0 < n := by dsimp [n]; omega
  have hnp : n < p - 1 := by dsimp [n]; omega
  have hln : l < n := by dsimp [n]; omega
  have hnl : n - l = k := by dsimp [n]; omega
  have hQ0 : P ^ k * X ^ l ≠ 0 := mul_ne_zero (pow_ne_zero _ hP0) (pow_ne_zero _ X_ne_zero)
  have hQdeg : (P ^ k * X ^ l).natDegree = p - 1 := by
    rw [natDegree_mul (pow_ne_zero _ hP0) (pow_ne_zero _ X_ne_zero),
      natDegree_pow, natDegree_X_pow]
    simpa [Nat.mul_comm] using hkl
  have hsum : (∑ x : ZMod p, x ^ l * (f x) ^ k) ≠ 0 := by
    have hh := sum_eval_top_degree (P ^ k * X ^ l) hQdeg
    have hne : -(P ^ k * X ^ l).leadingCoeff ≠ 0 := neg_ne_zero.mpr (leadingCoeff_ne_zero.mpr hQ0)
    rw [← hh] at hne
    simpa only [eval_mul, eval_pow, eval_X, hPeval, mul_comm] using hne
  have hchoose : (n.choose l : ZMod p) ≠ 0 := by
    intro he
    have hh := Nat.Prime.coprime_choose_of_lt (Fact.out : p.Prime) (show n < p by omega) hln.le
    exact ((Fact.out : p.Prime).coprime_iff_not_dvd.mp hh)
      ((ZMod.natCast_eq_zero_iff (n.choose l) p).mp he)
  refine ⟨n, hn, hsmall, ?_⟩
  intro he
  have hh := moment_coeff f n l hln
  rw [he, coeff_zero, hnl] at hh
  exact mul_ne_zero hchoose hsum hh.symm

private lemma direction_count_from_moment (p : ℕ) [Fact p.Prime] (hp2 : 2 < p)
    (f : ZMod p → ZMod p) (n : ℕ) (hn : 0 < n) (hsmall : 2 * n ≤ p - 1)
    (hP : momentPolynomial f n ≠ 0) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  classical
  let D : Set (ZMod p) := {m | ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)}
  let N := Dᶜ.toFinset
  have hnp : n < p - 1 := by omega
  have hroots : ∀ m ∈ N, -m ∈ (momentPolynomial f n).roots.toFinset := by
    intro m hm
    have hnot : m ∉ D := by simpa [N] using hm
    have hinj : Function.Injective (fun x : ZMod p => -m * x + f x) := by
      intro x y hxy
      by_contra hne
      apply hnot
      refine ⟨x, y, hne, ?_⟩
      linear_combination hxy
    have hbij : Function.Bijective (fun x : ZMod p => -m * x + f x) :=
      ⟨hinj, Finite.surjective_of_injective hinj⟩
    rw [Multiset.mem_toFinset, mem_roots hP, IsRoot.def, moment_eval f n hnp]
    rw [hbij.sum_comp (fun x : ZMod p => x ^ n)]
    apply FiniteField.sum_pow_lt_card_sub_one
    simpa using hnp
  have hcard : N.card ≤ n - 1 := by
    calc
      N.card ≤ (momentPolynomial f n).roots.toFinset.card :=
        Finset.card_le_card_of_injOn (fun m : ZMod p => -m) hroots
          (fun x _ y _ he => neg_injective he)
      _ ≤ (momentPolynomial f n).roots.card := Multiset.toFinset_card_le _
      _ ≤ (momentPolynomial f n).natDegree := Polynomial.card_roots' _
      _ ≤ n - 1 := moment_degree f n
  have htotal : D.ncard + N.card = p := by
    simpa only [N, Set.ncard_eq_toFinset_card', Set.toFinset_card,
      Nat.card_eq_fintype_card, ZMod.card] using Set.ncard_add_ncard_compl D
  change p + 3 ≤ 2 * D.ncard
  omega

theorem problem2 (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  obtain ⟨n, hn, hsmall, hP⟩ := nonzero_small_moment p hp f hf
  exact direction_count_from_moment p hp f n hn hsmall hP
