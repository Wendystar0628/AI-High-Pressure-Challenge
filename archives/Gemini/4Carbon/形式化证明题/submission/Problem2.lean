import Mathlib.Data.Set.Card
import Mathlib.FieldTheory.Finite.Basic

section Problem2Aux

open Polynomial Finset

private lemma sum_pow_zmod_lt {p : ℕ} [Fact p.Prime] (i : ℕ) (hi : i < p - 1) :
    ∑ x : ZMod p, x ^ i = 0 := by
  have hi' : i < Fintype.card (ZMod p) - 1 := by rwa [ZMod.card]
  exact FiniteField.sum_pow_lt_card_sub_one (ZMod p) i hi'

private lemma sum_pow_zmod_pred {p : ℕ} [Fact p.Prime] :
    ∑ x : ZMod p, x ^ (p - 1) = -1 := by
  have h1 : ∀ x : ZMod p, (1 : ZMod p) - x ^ (p - 1) = if x = 0 then 1 else 0 := by
    intro x
    rw [ZMod.pow_card_sub_one]
    split_ifs <;> simp_all
  have hsum : ∑ x : ZMod p, ((1 : ZMod p) - x ^ (p - 1)) = 1 := by
    simp_rw [h1]
    simp
  rw [Finset.sum_sub_distrib] at hsum
  have hp0 : ∑ _x : ZMod p, (1 : ZMod p) = 0 := by simp
  rw [hp0, zero_sub, neg_eq_iff_eq_neg] at hsum
  exact hsum

private lemma sum_eval_eq_neg_coeff {p : ℕ} [Fact p.Prime] (hp : 2 < p)
    (R : (ZMod p)[X]) (hdeg : R.natDegree ≤ p - 1) :
    ∑ x : ZMod p, R.eval x = -R.coeff (p - 1) := by
  have hlt_p : R.natDegree < p := by omega
  have heval : ∀ x : ZMod p, R.eval x = ∑ i ∈ range p, R.coeff i * x ^ i :=
    fun x => Polynomial.eval_eq_sum_range' hlt_p x
  calc ∑ x : ZMod p, R.eval x
      = ∑ x : ZMod p, ∑ i ∈ range p, R.coeff i * x ^ i :=
        Finset.sum_congr rfl fun x _ => heval x
    _ = ∑ i ∈ range p, R.coeff i * (∑ x : ZMod p, x ^ i) := by
        rw [Finset.sum_comm]
        exact Finset.sum_congr rfl fun i _ => (Finset.mul_sum _ _ _).symm
    _ = -R.coeff (p - 1) := by
        have hrange : range p = range ((p - 1) + 1) := congrArg range (by omega)
        rw [hrange, Finset.sum_range_succ]
        have hzero : ∑ i ∈ range (p - 1), R.coeff i * (∑ x : ZMod p, x ^ i) = 0 := by
          refine Finset.sum_eq_zero fun i hi => ?_
          rw [sum_pow_zmod_lt i (Finset.mem_range.mp hi), mul_zero]
        rw [hzero, zero_add, sum_pow_zmod_pred, mul_neg_one]

private lemma exists_interp_poly {p : ℕ} [Fact p.Prime] (f : ZMod p → ZMod p) :
    ∃ Q : (ZMod p)[X], Q.natDegree ≤ p - 1 ∧ ∀ x : ZMod p, Q.eval x = f x := by
  let Q : (ZMod p)[X] := ∑ a : ZMod p, C (f a) * (1 - (X - C a) ^ (p - 1))
  refine ⟨Q, ?_, ?_⟩
  · refine Polynomial.natDegree_sum_le_of_forall_le _ _ fun a _ => ?_
    refine le_trans (Polynomial.natDegree_C_mul_le _ _) ?_
    refine le_trans (Polynomial.natDegree_sub_le _ _) ?_
    simp only [Polynomial.natDegree_one]
    refine max_le (Nat.zero_le _) ?_
    refine le_trans Polynomial.natDegree_pow_le ?_
    rw [Polynomial.natDegree_X_sub_C, mul_one]
  · intro x
    simp only [Q, Polynomial.eval_finsetSum, Polynomial.eval_mul, Polynomial.eval_C,
      Polynomial.eval_sub, Polynomial.eval_one, Polynomial.eval_pow, Polynomial.eval_X]
    have hterm : ∀ a : ZMod p, f a * (1 - (x - a) ^ (p - 1)) = if a = x then f x else 0 := by
      intro a
      rw [ZMod.pow_card_sub_one]
      by_cases hax : a = x
      · subst hax; simp
      · have hne : x - a ≠ 0 := sub_ne_zero.mpr (Ne.symm hax)
        simp [hax, hne]
    simp_rw [hterm]
    simp

private lemma problem2_aux (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  classical
  obtain ⟨Q, hQ_deg, hQ_eval⟩ := exists_interp_poly f
  have hQ_ge2 : 2 ≤ Q.natDegree := by
    by_contra! hlt2
    apply hf
    refine ⟨Q.coeff 1, Q.coeff 0, fun x => ?_⟩
    rw [← hQ_eval x, Polynomial.eval_eq_sum_range' hlt2 x, Finset.sum_range_succ,
      Finset.sum_range_one]
    ring
  let d := Q.natDegree
  have hd_ge2 : 2 ≤ d := hQ_ge2
  have hd_le : d ≤ p - 1 := hQ_deg
  have hd_pos : 0 < d := by omega
  have hQ_ne : Q ≠ 0 := by
    intro h0
    have : d = 0 := by simp [d, h0]
    omega
  let m := (p - 1) / d
  let j₀ := (p - 1) % d
  let k := m + j₀
  have hdiv : d * m + j₀ = p - 1 := Nat.div_add_mod (p - 1) d
  have hj₀_lt : j₀ < d := Nat.mod_lt (p - 1) hd_pos
  have hm_pos : 1 ≤ m := Nat.div_pos (by omega) hd_pos
  have hd_le_dm : d ≤ d * m := Nat.le_mul_of_pos_right d hm_pos
  have hdm_ge : m + 1 ≤ d * m := by
    calc m + 1 ≤ m + m := by omega
      _ = 2 * m := by ring
      _ ≤ d * m := Nat.mul_le_mul_right m hd_ge2
  have hk_ge1 : 1 ≤ k := by omega
  have hk_le : k ≤ p - 2 := by omega
  have hp_prime : p.Prime := Fact.out
  have hp_odd : p % 2 = 1 := hp_prime.eq_two_or_odd.resolve_left (by omega)
  have hj₀_bound : 2 * j₀ ≤ p - 3 := by omega
  let P : (ZMod p)[X] := ∑ x : ZMod p, (C (-x) * X + C (f x)) ^ k
  let S : ℕ → ZMod p := fun j => ∑ x : ZMod p, x ^ j * (f x) ^ (k - j)
  have hP_eq : P = ∑ j ∈ range (k + 1),
      C ((-1 : ZMod p) ^ j * (k.choose j : ZMod p) * S j) * X ^ j := by
    dsimp only [P, S]
    have hexp : ∀ x : ZMod p, (C (-x) * X + C (f x)) ^ k =
        ∑ j ∈ range (k + 1),
          C ((-1 : ZMod p) ^ j * (k.choose j : ZMod p) * (x ^ j * (f x) ^ (k - j))) * X ^ j := by
      intro x
      rw [add_pow]
      refine Finset.sum_congr rfl fun j _ => ?_
      have hcast : (k.choose j : (ZMod p)[X]) = C (k.choose j : ZMod p) := by simp
      rw [mul_pow, ← C.map_pow, ← C.map_pow, hcast]
      calc (C ((-x) ^ j) * X ^ j) * C (f x ^ (k - j)) * C (k.choose j : ZMod p)
          = (C ((-x) ^ j) * C (f x ^ (k - j)) * C (k.choose j : ZMod p)) * X ^ j := by ring
        _ = C ((-x) ^ j * f x ^ (k - j) * (k.choose j : ZMod p)) * X ^ j := by
            rw [← C.map_mul, ← C.map_mul]
        _ = C ((-1 : ZMod p) ^ j * (k.choose j : ZMod p) * (x ^ j * f x ^ (k - j))) * X ^ j := by
            congr 2
            have hnx : (-x : ZMod p) = (-1 : ZMod p) * x := by ring
            rw [hnx, mul_pow]
            ring
    simp_rw [hexp]
    rw [Finset.sum_comm]
    refine Finset.sum_congr rfl fun j _ => ?_
    rw [← Finset.sum_mul, ← map_sum, ← Finset.mul_sum]
  have hP_coeff : ∀ j, P.coeff j =
      if j ≤ k then (-1 : ZMod p) ^ j * (k.choose j : ZMod p) * S j else 0 := by
    intro j
    rw [hP_eq, Polynomial.finsetSum_coeff]
    simp_rw [Polynomial.coeff_C_mul, Polynomial.coeff_X_pow, mul_ite, mul_one, mul_zero]
    rw [Finset.sum_ite_eq]
    simp only [Finset.mem_range, Nat.lt_succ_iff]
  have hS_gt : ∀ j, j₀ < j → j ≤ k → S j = 0 := by
    intro j hj_gt hj_le
    let R : (ZMod p)[X] := X ^ j * Q ^ (k - j)
    have hdeg_lt : j + (k - j) * d < p - 1 := by
      let t := j - j₀
      have ht1 : 1 ≤ t := by omega
      have htm : t ≤ m := by omega
      have hj_eq : j = j₀ + t := by omega
      have hkj_eq : k - j = m - t := by omega
      have htd : t + 1 ≤ t * d := by
        calc t + 1 ≤ t + t := by omega
          _ = t * 2 := by ring
          _ ≤ t * d := Nat.mul_le_mul_left t hd_ge2
      have hmul_split : (m - t) * d + t * d = d * m := by
        calc (m - t) * d + t * d = (m - t + t) * d := (Nat.add_mul _ _ _).symm
          _ = m * d := by rw [Nat.sub_add_cancel htm]
          _ = d * m := Nat.mul_comm _ _
      rw [hkj_eq, hj_eq]
      omega
    have hR_deg : R.natDegree < p - 1 := by
      refine lt_of_le_of_lt Polynomial.natDegree_mul_le ?_
      rw [Polynomial.natDegree_X_pow]
      have hpow : (Q ^ (k - j)).natDegree ≤ (k - j) * d := Polynomial.natDegree_pow_le
      omega
    have hR_eval : ∀ x : ZMod p, R.eval x = x ^ j * (f x) ^ (k - j) := by
      intro x
      simp [R, hQ_eval x]
    dsimp only [S]
    simp_rw [← hR_eval]
    rw [sum_eval_eq_neg_coeff hp R hR_deg.le,
      Polynomial.coeff_eq_zero_of_natDegree_lt hR_deg, neg_zero]
  have hS_j₀ : S j₀ ≠ 0 := by
    let R : (ZMod p)[X] := X ^ j₀ * Q ^ m
    have hkj₀ : k - j₀ = m := by omega
    have hXj₀_ne : (X ^ j₀ : (ZMod p)[X]) ≠ 0 := pow_ne_zero j₀ Polynomial.X_ne_zero
    have hQm_ne : Q ^ m ≠ 0 := pow_ne_zero m hQ_ne
    have hR_deg : R.natDegree = p - 1 := by
      dsimp only [R]
      rw [Polynomial.natDegree_mul hXj₀_ne hQm_ne, Polynomial.natDegree_X_pow,
        Polynomial.natDegree_pow]
      change j₀ + m * d = p - 1
      have : m * d = d * m := Nat.mul_comm _ _
      omega
    have hR_eval : ∀ x : ZMod p, R.eval x = x ^ j₀ * (f x) ^ (k - j₀) := by
      intro x
      simp [R, hkj₀, hQ_eval x]
    dsimp only [S]
    simp_rw [← hR_eval]
    rw [sum_eval_eq_neg_coeff hp R hR_deg.le, ← hR_deg]
    have hR_ne : R ≠ 0 := mul_ne_zero hXj₀_ne hQm_ne
    exact neg_ne_zero.mpr (Polynomial.leadingCoeff_ne_zero.mpr hR_ne)
  have hP_deg : P.natDegree ≤ j₀ := by
    rw [Polynomial.natDegree_le_iff_coeff_eq_zero]
    intro j hj
    rw [hP_coeff]
    split_ifs with hjk
    · rw [hS_gt j hj hjk, mul_zero]
    · rfl
  have hP_ne : P ≠ 0 := by
    intro h0
    have hc0 : P.coeff j₀ = 0 := by simp [h0]
    have hj₀_le_k : j₀ ≤ k := by omega
    simp only [hP_coeff, hj₀_le_k, ↓reduceIte] at hc0
    have h1_ne : (-1 : ZMod p) ^ j₀ ≠ 0 := pow_ne_zero j₀ (neg_ne_zero.mpr one_ne_zero)
    have hchoose_ne : (k.choose j₀ : ZMod p) ≠ 0 := by
      rw [Ne, ZMod.natCast_eq_zero_iff]
      intro hdvd
      have hfac := Nat.choose_mul_factorial_mul_factorial (show j₀ ≤ k by omega)
      have hdvd_fac : p ∣ k.factorial := by
        rw [← hfac]
        exact dvd_mul_of_dvd_left (dvd_mul_of_dvd_left hdvd _) _
      have hnot_dvd_fac : ∀ n < p, ¬ (p ∣ n.factorial) := by
        intro n
        induction n with
        | zero =>
          intro _ hd
          exact absurd (Nat.le_of_dvd Nat.one_pos hd) (by omega)
        | succ n ih =>
          intro hlt hd
          rw [Nat.factorial_succ] at hd
          rcases hp_prime.dvd_mul.mp hd with h1 | h2
          · exact absurd (Nat.le_of_dvd (Nat.succ_pos n) h1) (by omega)
          · exact ih (by omega) h2
      exact hnot_dvd_fac k (by omega) hdvd_fac
    exact mul_ne_zero (mul_ne_zero h1_ne hchoose_ne) hS_j₀ hc0
  let D : Set (ZMod p) := {m : ZMod p | ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)}
  let Df : Finset (ZMod p) := Finset.univ.filter (fun c => c ∈ D)
  let Dc : Finset (ZMod p) := Finset.univ.filter (fun c => c ∉ D)
  have hDc_roots : ∀ c ∈ Dc, c ∈ P.roots := by
    intro c hc
    have hc_notD : c ∉ D := (Finset.mem_filter.mp hc).2
    rw [Polynomial.mem_roots hP_ne, Polynomial.IsRoot]
    have heval_c : P.eval c = ∑ x : ZMod p, (f x - c * x) ^ k := by
      simp only [P, Polynomial.eval_finsetSum, Polynomial.eval_pow, Polynomial.eval_add,
        Polynomial.eval_mul, Polynomial.eval_C, Polynomial.eval_X]
      refine Finset.sum_congr rfl fun x _ => ?_
      ring
    rw [heval_c]
    have hinj : Function.Injective (fun x : ZMod p => f x - c * x) := by
      intro x y hxy
      by_contra hne
      apply hc_notD
      refine ⟨x, y, hne, ?_⟩
      linear_combination hxy
    let e : ZMod p ≃ ZMod p := Equiv.ofBijective _ (Finite.injective_iff_bijective.mp hinj)
    have hsum_e : ∑ x : ZMod p, (f x - c * x) ^ k = ∑ z : ZMod p, z ^ k :=
      Equiv.sum_comp e (fun z => z ^ k)
    rw [hsum_e]
    exact sum_pow_zmod_lt k (by omega)
  have hDc_card : Dc.card ≤ j₀ :=
    le_trans (Polynomial.card_le_degree_of_subset_roots hDc_roots) hP_deg
  have hsum_card : Df.card + Dc.card = p := by
    have hunion : Df ∪ Dc = Finset.univ := by
      ext c
      simp only [Df, Dc, Finset.mem_union, Finset.mem_filter, Finset.mem_univ, true_and,
        iff_true]
      exact em (c ∈ D)
    have hdisj : Disjoint Df Dc := by
      rw [Finset.disjoint_left]
      intro c h1 h2
      exact (Finset.mem_filter.mp h2).2 (Finset.mem_filter.mp h1).2
    have hcard := (Finset.card_union_of_disjoint hdisj).symm
    rw [hunion, Finset.card_univ, ZMod.card] at hcard
    exact hcard
  have hDf_ncard : D.ncard = Df.card := by
    have hset : (Df : Set (ZMod p)) = D := by
      ext c
      simp [Df]
    rw [← hset, Set.ncard_coe_finset]
  change p + 3 ≤ 2 * D.ncard
  rw [hDf_ncard]
  omega

end Problem2Aux

theorem problem2 (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  exact problem2_aux p hp f hf
