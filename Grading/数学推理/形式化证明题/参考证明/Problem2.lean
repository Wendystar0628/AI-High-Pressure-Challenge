import Mathlib.FieldTheory.Finite.Basic
import Mathlib.LinearAlgebra.Lagrange
import Mathlib.Algebra.Polynomial.Degree.SmallDegree
import Mathlib.Data.Nat.Choose.Dvd
import Mathlib.Data.Set.Card
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring
import Mathlib.Tactic.LinearCombination

open Polynomial Finset

-- Euclidean division gives a mixed power of total degree at most half of n.
private lemma exponent_bound (n d : ℕ) (hn : Even n) (hd : 2 ≤ d) (hdn : d ≤ n) :
    ∃ a b : ℕ, 0 < b ∧ a + b * d = n ∧ 2 * (a + b) ≤ n := by
  refine ⟨n % d, n / d, Nat.div_pos hdn (by omega), ?_, ?_⟩
  · simpa [Nat.mul_comm] using Nat.mod_add_div n d
  · have hr := Nat.mod_lt n (show 0 < d by omega)
    have he := Nat.mod_add_div n d
    have hb : 0 < n / d := Nat.div_pos hdn (by omega)
    obtain ⟨t, ht⟩ := hn
    by_cases hd2 : d = 2
    · subst d
      omega
    by_cases hb1 : n / d = 1
    · rw [hb1] at he ⊢
      omega
    · have hprod : 0 ≤ (n / d - 2) * (d - 2) := Nat.zero_le _
      have hb2 : 2 ≤ n / d := by omega
      have hd3 : 3 ≤ d := by omega
      nlinarith

private lemma sum_pow_top (p : ℕ) [Fact p.Prime] :
    (∑ x : ZMod p, x ^ (p - 1)) = -1 := by
  classical
  simp_rw [ZMod.pow_card_sub_one]
  simp only [Finset.sum_ite, Finset.sum_const, add_zero,
    nsmul_eq_mul, mul_one, mul_zero]
  rw [Finset.filter_ne', Finset.card_erase_of_mem (Finset.mem_univ 0),
    Finset.card_univ, ZMod.card, Nat.cast_sub (show 1 ≤ p from
      (Fact.out : p.Prime).one_lt.le), ZMod.natCast_self, Nat.cast_one, zero_sub]

private lemma sum_eval_top (p : ℕ) [Fact p.Prime] (P : (ZMod p)[X])
    (hP : P.natDegree = p - 1) :
    (∑ x : ZMod p, P.eval x) = -P.leadingCoeff := by
  classical
  simp_rw [Polynomial.eval_eq_sum_range]
  rw [Finset.sum_comm]
  simp_rw [← Finset.mul_sum]
  rw [Finset.sum_range_succ]
  have hz : (∑ i ∈ Finset.range P.natDegree,
      P.coeff i * ∑ x : ZMod p, x ^ i) = 0 := by
    apply Finset.sum_eq_zero
    intro i hi
    rw [FiniteField.sum_pow_lt_card_sub_one, mul_zero]
    simpa [ZMod.card, hP] using Finset.mem_range.mp hi
  rw [hz, zero_add, hP, sum_pow_top, ← hP]
  rw [Polynomial.coeff_natDegree]
  ring

-- The polynomial whose value at t is the kth power sum of t*x + f(x).
private noncomputable def moment (p : ℕ) [Fact p.Prime]
    (f : ZMod p → ZMod p) (k : ℕ) : (ZMod p)[X] :=
  ∑ j ∈ range (k + 1),
    C ((k.choose j : ZMod p) * ∑ x : ZMod p, x ^ j * f x ^ (k - j)) * X ^ j

private lemma moment_coeff (p : ℕ) [Fact p.Prime] (f : ZMod p → ZMod p)
    (k j : ℕ) (hj : j ≤ k) :
    (moment p f k).coeff j =
      (k.choose j : ZMod p) * ∑ x : ZMod p, x ^ j * f x ^ (k - j) := by
  classical
  unfold moment
  rw [Polynomial.finsetSum_coeff]
  simp only [Polynomial.coeff_C_mul_X_pow]
  simp [Nat.lt_succ_iff.mpr hj]

private lemma moment_eval (p : ℕ) [Fact p.Prime] (f : ZMod p → ZMod p)
    (k : ℕ) (t : ZMod p) :
    (moment p f k).eval t = ∑ x : ZMod p, (t * x + f x) ^ k := by
  classical
  simp only [moment, Polynomial.eval_finsetSum, Polynomial.eval_mul,
    Polynomial.eval_C, Polynomial.eval_pow, Polynomial.eval_X]
  simp_rw [Finset.mul_sum, Finset.sum_mul]
  rw [Finset.sum_comm]
  apply Finset.sum_congr rfl
  intro x hx
  rw [add_pow]
  apply Finset.sum_congr rfl
  intro j hj
  rw [mul_pow]
  ring

private lemma moment_degree (p : ℕ) [Fact p.Prime] (f : ZMod p → ZMod p)
    (k : ℕ) (hk : k < p - 1) :
    (moment p f k).natDegree ≤ k - 1 := by
  classical
  unfold moment
  rw [Finset.sum_range_succ]
  have hsum : (∑ x : ZMod p, x ^ k) = 0 := by
    apply FiniteField.sum_pow_lt_card_sub_one
    simpa [ZMod.card] using hk
  simp only [Nat.choose_self, Nat.cast_one, Nat.sub_self, pow_zero, mul_one,
    hsum, mul_zero, map_zero, zero_mul, add_zero]
  apply Polynomial.natDegree_sum_le_of_forall_le
  intro i hi
  exact (Polynomial.natDegree_C_mul_X_pow_le _ _).trans (by
    have := Finset.mem_range.mp hi
    omega)

private lemma exists_small_moment (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    ∃ k : ℕ, 0 < k ∧ 2 * k ≤ p - 1 ∧ moment p f k ≠ 0 := by
  classical
  let P : (ZMod p)[X] := Lagrange.interpolate Finset.univ (fun x : ZMod p => x) f
  have hPeval (x : ZMod p) : P.eval x = f x := by
    exact Lagrange.eval_interpolate_at_node f (fun _ _ _ _ h => h) (Finset.mem_univ x)
  have hPdeg : P.natDegree < p := by
    have hh := Lagrange.degree_interpolate_lt f
      (show Set.InjOn (fun x : ZMod p => x) (↑(Finset.univ : Finset (ZMod p))) from
        fun _ _ _ _ h => h)
    rw [Finset.card_univ, ZMod.card] at hh
    exact (Polynomial.natDegree_lt_iff_degree_lt (by
      intro hz
      apply hf
      refine ⟨0, 0, fun x => ?_⟩
      rw [← hPeval x, hz]
      simp)).mpr hh
  have hPtwo : 2 ≤ P.natDegree := by
    by_contra hh
    have hh' : P.natDegree ≤ 1 := by omega
    apply hf
    refine ⟨P.coeff 1, P.coeff 0, fun x => ?_⟩
    rw [← hPeval x, Polynomial.eq_X_add_C_of_natDegree_le_one hh']
    simp
  have hPne : P ≠ 0 := by
    intro hh
    simp [hh] at hPtwo
  obtain ⟨a, b, hb, hab, hbound⟩ := exponent_bound (p - 1) P.natDegree
    ((Fact.out : p.Prime).even_sub_one (by omega)) hPtwo (by omega)
  refine ⟨a + b, by omega, hbound, ?_⟩
  -- X^a * P^b has degree p-1, so its sum of values is nonzero.
  have hsum : (∑ x : ZMod p, x ^ a * f x ^ b) ≠ 0 := by
    let R : (ZMod p)[X] := X ^ a * P ^ b
    have hRdeg : R.natDegree = p - 1 := by
      dsimp [R]
      rw [Polynomial.natDegree_X_pow_mul _ (pow_ne_zero _ hPne),
        Polynomial.natDegree_pow]
      omega
    have hRne : R ≠ 0 := mul_ne_zero (pow_ne_zero _ Polynomial.X_ne_zero)
      (pow_ne_zero _ hPne)
    have hs := sum_eval_top p R hRdeg
    have hr : R.leadingCoeff ≠ 0 := Polynomial.leadingCoeff_ne_zero.mpr hRne
    have heval (x : ZMod p) : R.eval x = x ^ a * f x ^ b := by
      simp only [R, Polynomial.eval_mul, Polynomial.eval_pow, Polynomial.eval_X, hPeval]
    simp_rw [heval] at hs
    rw [hs]
    exact neg_ne_zero.mpr hr
  have hchoose : ((a + b).choose a : ZMod p) ≠ 0 := by
    apply IsUnit.ne_zero
    apply (ZMod.isUnit_iff_coprime _ _).mpr
    exact ((Fact.out : p.Prime).coprime_choose_of_lt (by omega) (by omega)).symm
  intro hzero
  have hc := moment_coeff p f (a + b) a (by omega)
  rw [hzero, Polynomial.coeff_zero, Nat.add_sub_cancel_left] at hc
  exact mul_ne_zero hchoose hsum hc.symm

theorem problem2 (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  classical
  let D : Set (ZMod p) := {m | ∃ x y : ZMod p,
    x ≠ y ∧ f x - f y = m * (x - y)}
  obtain ⟨k, hkpos, hkbound, hkne⟩ := exists_small_moment p hp f hf
  have hklt : k < p - 1 := by omega
  have hdegree := moment_degree p f k hklt
  have heval (m : {m : ZMod p // m ∉ D}) : (moment p f k).eval (-m.val) = 0 := by
    let g : ZMod p → ZMod p := fun x => f x - m.val * x
    have hginj : Function.Injective g := by
      intro x y hxy
      by_contra hne
      apply m.property
      refine ⟨x, y, hne, ?_⟩
      dsimp [g] at hxy
      linear_combination hxy
    have hgbij : Function.Bijective g :=
      ⟨hginj, (Finite.injective_iff_surjective).mp hginj⟩
    rw [moment_eval]
    have hh : (∑ x : ZMod p, (-m.val * x + f x) ^ k) =
        ∑ x : ZMod p, (g x) ^ k := by
      apply Finset.sum_congr rfl
      intro x hx
      congr 1
      dsimp [g]
      ring
    rw [hh, hgbij.sum_comp (fun x => x ^ k)]
    apply FiniteField.sum_pow_lt_card_sub_one
    simpa [ZMod.card] using hklt
  have hcard : Dᶜ.ncard ≤ (moment p f k).natDegree := by
    by_contra hh
    apply hkne
    apply Polynomial.eq_zero_of_natDegree_lt_card_of_eval_eq_zero _
      (f := fun m : {m : ZMod p // m ∉ D} => -m.val) _ heval
    · rw [show Fintype.card {m : ZMod p // m ∉ D} = Dᶜ.ncard from
        Set.fintypeCard_eq_ncard (Dᶜ)]
      exact Nat.lt_of_not_ge hh
    · intro x y hxy
      apply Subtype.ext
      exact neg_injective hxy
  have htotal := Set.ncard_add_ncard_compl D
  rw [Nat.card_eq_fintype_card, ZMod.card] at htotal
  change p + 3 ≤ 2 * D.ncard
  omega
