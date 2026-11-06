import Mathlib.FieldTheory.Finite.Basic
import Mathlib.Algebra.Polynomial.Roots
import Mathlib.Data.Nat.Prime.Factorial
import Mathlib.Data.Set.Card

open Polynomial Finset

namespace P2

variable {p : ℕ} [Fact p.Prime]

lemma sum_pow_lt (k : ℕ) (hk : k < p - 1) : ∑ x : ZMod p, x ^ k = 0 :=
  FiniteField.sum_pow_lt_card_sub_one (ZMod p) k (by rw [ZMod.card]; exact hk)

lemma sum_pow_card_sub_one : ∑ x : ZMod p, x ^ (p - 1) = -1 := by
  have hp1 := (Fact.out : p.Prime).one_lt
  have h : ∀ x : ZMod p, x ^ (p - 1) = if x = 0 then 0 else 1 := by
    intro x
    split_ifs with hx
    · rw [hx, zero_pow (by omega)]
    · exact ZMod.pow_card_sub_one_eq_one hx
  simp_rw [h]
  rw [Finset.sum_ite, Finset.sum_const_zero, zero_add, Finset.sum_const, nsmul_eq_mul, mul_one]
  rw [Finset.filter_ne' Finset.univ (0 : ZMod p), Finset.card_erase_of_mem (Finset.mem_univ _),
    Finset.card_univ, ZMod.card]
  rw [Nat.cast_sub hp1.le, ZMod.natCast_self]
  simp

lemma sum_eval_eq (G : (ZMod p)[X]) (hG : G.natDegree ≤ p - 1) :
    ∑ x : ZMod p, G.eval x = - G.coeff (p - 1) := by
  have hp1 := (Fact.out : p.Prime).one_lt
  have h : ∀ x, G.eval x = ∑ i ∈ range p, G.coeff i * x ^ i :=
    fun x => eval_eq_sum_range' (by omega) x
  simp_rw [h]
  rw [Finset.sum_comm]
  simp_rw [← Finset.mul_sum]
  rw [Finset.sum_eq_single (p - 1)]
  · rw [sum_pow_card_sub_one]; ring
  · intro k hk hne
    rw [Finset.mem_range] at hk
    rw [sum_pow_lt k (by omega), mul_zero]
  · intro h; simp at h; omega

lemma arith (N d : ℕ) (hN : N % 2 = 0) (hd : 2 ≤ d) (hdN : d ≤ N) :
    N / d + N % d ≤ N / 2 := by
  have h1 := Nat.div_add_mod N d
  have h2 := Nat.mod_lt N (by omega : d > 0)
  set q := N / d with hq
  set ρ := N % d with hρ
  have hq1 : 1 ≤ q := Nat.div_pos hdN (by omega)
  -- want 2q + ρ ≤ d q
  suffices h : 2 * q + ρ ≤ d * q by omega
  rcases Nat.lt_or_ge d 3 with h3 | h3
  · have : d = 2 := by omega
    subst this
    omega
  · rcases Nat.lt_or_ge q 2 with hq2 | hq2
    · have : q = 1 := by omega
      rw [this] at h1 ⊢
      omega
    · have : 2 * (d - 2) ≤ q * (d - 2) := Nat.mul_le_mul_right _ hq2
      have e : d * q = q * (d - 2) + 2 * q := by
        rw [Nat.mul_comm d q]
        have : d = (d - 2) + 2 := by omega
        conv_lhs => rw [this]
        ring
      omega

lemma exists_poly (f : ZMod p → ZMod p) :
    ∃ F : (ZMod p)[X], F.natDegree ≤ p - 1 ∧ ∀ x, F.eval x = f x := by
  have hp1 := (Fact.out : p.Prime).one_lt
  refine ⟨∑ a : ZMod p, C (f a) * (1 - (X - C a) ^ (p - 1)), ?_, ?_⟩
  · apply natDegree_sum_le_of_forall_le
    intro a _
    refine (natDegree_C_mul_le _ _).trans ?_
    refine (natDegree_sub_le _ _).trans ?_
    rw [natDegree_one]
    refine max_le (Nat.zero_le _) ?_
    refine (natDegree_pow_le).trans ?_
    rw [natDegree_X_sub_C, mul_one]
  · intro x
    rw [eval_finsetSum]
    rw [Finset.sum_eq_single x]
    · simp [zero_pow (by omega : p - 1 ≠ 0)]
    · intro a _ hax
      have : x - a ≠ 0 := sub_ne_zero.mpr (Ne.symm hax)
      simp [ZMod.pow_card_sub_one_eq_one this]
    · intro h; exact absurd (Finset.mem_univ x) h

lemma key (hp : 2 < p) (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    ∃ i j : ℕ, 1 ≤ i ∧ i + j ≤ (p - 1) / 2 ∧ ∑ x : ZMod p, x ^ j * f x ^ i ≠ 0 := by
  have hpo : p % 2 = 1 := by
    rcases (Fact.out : p.Prime).eq_two_or_odd with h | h
    · omega
    · exact h
  obtain ⟨F, hFdeg, hFeval⟩ := exists_poly f
  set d := F.natDegree with hd
  by_cases hd1 : d ≤ 1
  · exfalso
    apply hf
    refine ⟨F.coeff 1, F.coeff 0, fun x => ?_⟩
    rw [← hFeval x, eq_X_add_C_of_natDegree_le_one hd1]
    simp
  push_neg at hd1
  have hF0 : F ≠ 0 := by
    intro h; rw [h] at hd; simp at hd; omega
  refine ⟨(p - 1) / d, (p - 1) % d, Nat.div_pos hFdeg (by omega),
    arith (p - 1) d (by omega) hd1 hFdeg, ?_⟩
  set G := X ^ ((p - 1) % d) * F ^ ((p - 1) / d) with hG
  have hGeval : ∀ x, G.eval x = x ^ ((p - 1) % d) * f x ^ ((p - 1) / d) := by
    intro x; simp [hG, hFeval]
  have hGdeg : G.natDegree = p - 1 := by
    rw [hG, natDegree_mul (pow_ne_zero _ X_ne_zero) (pow_ne_zero _ hF0), natDegree_X_pow,
      natDegree_pow, ← hd]
    rw [Nat.mul_comm]; exact Nat.mod_add_div (p - 1) d
  have hGlead : G.coeff (p - 1) = F.leadingCoeff ^ ((p - 1) / d) := by
    have : G.coeff (p - 1) = G.leadingCoeff := by rw [leadingCoeff, hGdeg]
    rw [this, hG, leadingCoeff_mul, leadingCoeff_X_pow, leadingCoeff_pow, one_mul]
  simp_rw [← hGeval]
  rw [sum_eval_eq G hGdeg.le, hGlead, neg_ne_zero]
  exact pow_ne_zero _ (leadingCoeff_ne_zero.mpr hF0)

end P2

open P2 in
theorem problem2 (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  have hpo : p % 2 = 1 := by
    rcases (Fact.out : p.Prime).eq_two_or_odd with h | h
    · omega
    · exact h
  obtain ⟨i, j, hi, hij, hsum⟩ := key hp f hf
  set k := i + j with hk
  have hkp : k < p - 1 := by omega
  let e : ℕ → ZMod p := fun l => (k.choose l : ZMod p) * ∑ x : ZMod p, (-x) ^ l * f x ^ (k - l)
  let Q : (ZMod p)[X] := ∑ l ∈ range k, C (e l) * X ^ l
  have hQeval : ∀ m : ZMod p, Q.eval m = ∑ x : ZMod p, (f x - m * x) ^ k := by
    intro m
    have h1 : ∀ x : ZMod p, (f x - m * x) ^ k =
        ∑ l ∈ range k, (k.choose l : ZMod p) * m ^ l * ((-x) ^ l * f x ^ (k - l))
          + (-m) ^ k * x ^ k := by
      intro x
      rw [sub_eq_neg_add, add_pow, Finset.sum_range_succ]
      congr 1
      · apply Finset.sum_congr rfl
        intro l _
        rw [show -(m * x) = m * (-x) by ring, mul_pow]
        ring
      · rw [Nat.sub_self, pow_zero, Nat.choose_self, Nat.cast_one, mul_one, mul_one,
          show -(m * x) = (-m) * x by ring, mul_pow]
    simp_rw [h1]
    rw [Finset.sum_add_distrib, ← Finset.mul_sum, sum_pow_lt k hkp, mul_zero, add_zero,
      Finset.sum_comm]
    simp only [Q, e, eval_finsetSum, eval_mul, eval_C, eval_pow, eval_X]
    apply Finset.sum_congr rfl
    intro l _
    rw [← Finset.mul_sum]
    ring
  have hQdeg : Q.natDegree ≤ k - 1 := by
    apply natDegree_sum_le_of_forall_le
    intro l hl
    rw [Finset.mem_range] at hl
    exact (natDegree_C_mul_X_pow_le _ _).trans (by omega)
  have hQcoeff : Q.coeff j = e j := by
    simp only [Q, finsetSum_coeff, coeff_C_mul_X_pow]
    rw [Finset.sum_ite_eq]
    rw [if_pos (Finset.mem_range.mpr (by omega))]
  have hej : e j ≠ 0 := by
    have hchoose : (k.choose j : ZMod p) ≠ 0 := by
      rw [Ne, ZMod.natCast_eq_zero_iff]
      intro hdvd
      have h2 := Nat.choose_mul_factorial_mul_factorial (show j ≤ k by omega)
      have h3 : p ∣ k.factorial := by
        rw [← h2]
        exact Dvd.dvd.mul_right (Dvd.dvd.mul_right hdvd _) _
      rw [(Fact.out : p.Prime).dvd_factorial] at h3
      omega
    simp only [e]
    refine mul_ne_zero hchoose ?_
    have : ∑ x : ZMod p, (-x) ^ j * f x ^ (k - j)
        = (-1) ^ j * ∑ x : ZMod p, x ^ j * f x ^ i := by
      rw [Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro x _
      rw [show k - j = i by omega, neg_pow]
      ring
    rw [this]
    exact mul_ne_zero (pow_ne_zero _ (by simp)) hsum
  have hQ0 : Q ≠ 0 := by
    intro h
    rw [h, coeff_zero] at hQcoeff
    exact hej hQcoeff.symm
  -- non-directions
  set D := {m : ZMod p | ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} with hD
  let N : Finset (ZMod p) := Finset.univ.filter (fun m => m ∉ D)
  have hNroots : N.val ⊆ Q.roots := by
    intro m hm
    have hm' : m ∉ D := (Finset.mem_filter.mp hm).2
    rw [mem_roots hQ0, IsRoot.def, hQeval]
    have hinj : Function.Injective (fun x => f x - m * x) := by
      intro x y hxy
      by_contra hne
      apply hm'
      refine ⟨x, y, hne, ?_⟩
      simp only at hxy
      linear_combination hxy
    have hbij := Finite.injective_iff_bijective.mp hinj
    rw [hbij.sum_comp (fun y => y ^ k)]
    exact sum_pow_lt k hkp
  have hNcard : N.card ≤ k - 1 :=
    (card_le_degree_of_subset_roots hNroots).trans hQdeg
  have hcompl : (Dᶜ : Set (ZMod p)) = (N : Set (ZMod p)) := by
    ext m; simp [N]
  have htot := Set.ncard_add_ncard_compl D
  rw [hcompl, Set.ncard_coe_finset, Nat.card_eq_fintype_card, ZMod.card] at htot
  omega
