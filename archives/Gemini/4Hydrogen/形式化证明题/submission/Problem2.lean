import Mathlib.Algebra.Polynomial.Bivariate
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.Data.Set.Card
import Mathlib.Tactic.Linarith

open Polynomial

private lemma prod_univ_X_sub_C (p : ℕ) [Fact p.Prime] :
    ∏ m : ZMod p, (X - C m) = X ^ p - X := by
  have hp1 : 1 < p := Nat.Prime.one_lt Fact.out
  have hmon : (X ^ p - X : (ZMod p)[X]).Monic :=
    monic_X_pow_sub (degree_X_le.trans_lt (by exact_mod_cast hp1))
  have hroots : (X ^ p - X : (ZMod p)[X]).roots = Finset.univ.val := by
    simpa [ZMod.card p] using FiniteField.roots_X_pow_card_sub_X (K := ZMod p)
  have hcard : Multiset.card (X ^ p - X : (ZMod p)[X]).roots =
      (X ^ p - X : (ZMod p)[X]).natDegree := by
    rw [hroots]
    change (Finset.univ : Finset (ZMod p)).card = _
    rw [Finset.card_univ, ZMod.card p,
      FiniteField.X_pow_card_sub_X_natDegree_eq (K' := ZMod p) hp1]
  have hprod := prod_multiset_X_sub_C_of_monic_of_roots_card_eq hmon hcard
  rw [hroots] at hprod
  simpa using hprod

private lemma eq_zero_of_natDegree_lt_of_forall_eval_zero {p : ℕ} [Fact p.Prime]
    {q : (ZMod p)[X]} (hdeg : q.natDegree < p) (heval : ∀ x : ZMod p, q.eval x = 0) :
    q = 0 := by
  by_contra hq
  have hsub : (Finset.univ : Finset (ZMod p)) ⊆ q.roots.toFinset := by
    intro x _
    rw [Multiset.mem_toFinset, mem_roots hq, IsRoot.def]
    exact heval x
  have hcard : p ≤ q.natDegree := by
    calc p = (Finset.univ : Finset (ZMod p)).card := by rw [Finset.card_univ, ZMod.card p]
      _ ≤ q.roots.toFinset.card := Finset.card_le_card hsub
      _ ≤ Multiset.card q.roots := Multiset.toFinset_card_le q.roots
      _ ≤ q.natDegree := q.card_roots'
  omega

private lemma bivariate_prod_coeff_bounds {p : ℕ} [Fact p.Prime]
    (g : ZMod p → ZMod p) (s : Finset (ZMod p)) :
    (∀ k, ((∏ x ∈ s, (X + C (C x * X - C (g x))) : (ZMod p)[X][X]).coeff k).natDegree ≤
      s.card - k) ∧
    (∀ k, s.card < k →
      ((∏ x ∈ s, (X + C (C x * X - C (g x))) : (ZMod p)[X][X]).coeff k) = 0) ∧
    (∀ k, k ≤ s.card →
      (((∏ x ∈ s, (X + C (C x * X - C (g x))) : (ZMod p)[X][X]) -
        ∏ x ∈ s, (X + C (C x * X))).coeff k).coeff (s.card - k) = 0) := by
  classical
  induction s using Finset.induction_on with
  | empty =>
    refine ⟨fun k => ?_, fun k hk => ?_, fun k hk => ?_⟩
    · simp only [Finset.prod_empty, Finset.card_empty, Nat.zero_sub]
      rw [coeff_one]
      split_ifs <;> simp
    · simp only [Finset.prod_empty, Finset.card_empty] at hk ⊢
      simp [coeff_one, hk.ne']
    · simp only [Finset.prod_empty, sub_self, coeff_zero]
  | insert x s hxs ih =>
    rcases ih with ⟨ih_deg, ih_zero, ih_top⟩
    set P : (ZMod p)[X][X] := ∏ y ∈ s, (X + C (C y * X - C (g y)))
    set P₀ : (ZMod p)[X][X] := ∏ y ∈ s, (X + C (C y * X))
    have ih₀_zero : ∀ k, s.card < k → P₀.coeff k = 0 := by
      intro k hk
      have hdegP₀ : P₀.natDegree ≤ s.card := by
        calc P₀.natDegree ≤ ∑ y ∈ s, (X + C (C y * X) : (ZMod p)[X][X]).natDegree :=
              natDegree_prod_le _ _
          _ ≤ ∑ _y ∈ s, 1 := Finset.sum_le_sum fun y _ =>
              le_trans (natDegree_add_le _ _)
                (max_le natDegree_X_le (by rw [natDegree_C]; exact Nat.zero_le _))
          _ = s.card := by simp
      exact coeff_eq_zero_of_natDegree_lt (hdegP₀.trans_lt hk)
    set a : (ZMod p)[X] := C x * X - C (g x)
    set a₀ : (ZMod p)[X] := C x * X
    have ha_deg : a.natDegree ≤ 1 := by
      calc a.natDegree ≤ max (C x * X : (ZMod p)[X]).natDegree (C (g x)).natDegree :=
            natDegree_sub_le _ _
        _ ≤ 1 := by
            simp only [natDegree_C, zero_le, max_eq_left]
            exact (natDegree_C_mul_le _ _).trans natDegree_X_le
    have hP_ins : ∏ y ∈ insert x s, (X + C (C y * X - C (g y))) = (X + C a) * P := by
      rw [Finset.prod_insert hxs]
    have hP₀_ins : ∏ y ∈ insert x s, (X + C (C y * X)) = (X + C a₀) * P₀ := by
      rw [Finset.prod_insert hxs]
    rw [Finset.card_insert_of_notMem hxs]
    refine ⟨fun k => ?_, fun k hk => ?_, fun k hk => ?_⟩
    · rw [hP_ins, add_mul, coeff_add, coeff_C_mul]
      cases k with
      | zero =>
        rw [coeff_X_mul_zero, zero_add, Nat.sub_zero]
        by_cases hP0 : P.coeff 0 = 0
        · simp [hP0]
        · exact (natDegree_mul_le).trans (by simpa [Nat.add_comm] using Nat.add_le_add ha_deg (ih_deg 0))
      | succ k =>
        rw [coeff_X_mul]
        refine (natDegree_add_le _ _).trans (max_le ?_ ?_)
        · calc (P.coeff k).natDegree ≤ s.card - k := ih_deg k
            _ = s.card + 1 - (k + 1) := by omega
        · by_cases hlt : s.card < k + 1
          · simp [ih_zero (k + 1) hlt]
          · calc (a * P.coeff (k + 1)).natDegree
                ≤ a.natDegree + (P.coeff (k + 1)).natDegree := natDegree_mul_le
              _ ≤ 1 + (s.card - (k + 1)) := Nat.add_le_add ha_deg (ih_deg (k + 1))
              _ = s.card + 1 - (k + 1) := by omega
    · rw [hP_ins, add_mul, coeff_add, coeff_C_mul]
      cases k with
      | zero => omega
      | succ k =>
        rw [coeff_X_mul, ih_zero k (by omega), ih_zero (k + 1) (by omega), mul_zero, add_zero]
    · rw [hP_ins, hP₀_ins]
      have hdiff : (X + C a) * P - (X + C a₀) * P₀ =
          (X + C a₀) * (P - P₀) - C (C (g x)) * P := by
        have haa₀ : a - a₀ = - C (g x) := by simp [a, a₀]
        calc (X + C a) * P - (X + C a₀) * P₀
            = (X + C a₀) * (P - P₀) + (C a - C a₀) * P := by ring
          _ = (X + C a₀) * (P - P₀) + C (a - a₀) * P := by rw [← map_sub]
          _ = (X + C a₀) * (P - P₀) - C (C (g x)) * P := by
              rw [haa₀, map_neg]; ring
      rw [hdiff, coeff_sub, add_mul, coeff_add, coeff_C_mul, coeff_C_mul, coeff_sub]
      cases k with
      | zero =>
        rw [coeff_X_mul_zero, zero_add, Nat.sub_zero]
        have h1 : (a₀ * (P.coeff 0 - P₀.coeff 0)).coeff (s.card + 1) = 0 := by
          rw [show a₀ = C x * X from rfl, mul_assoc, coeff_C_mul, mul_comm X, coeff_mul_X]
          have hsub0 : (P - P₀).coeff 0 = P.coeff 0 - P₀.coeff 0 := coeff_sub P P₀ 0
          have htop0 : ((P - P₀).coeff 0).coeff s.card = 0 := by
            simpa using ih_top 0 (Nat.zero_le _)
          rw [← hsub0, htop0, mul_zero]
        have h2 : (C (g x) * P.coeff 0).coeff (s.card + 1) = 0 := by
          apply coeff_eq_zero_of_natDegree_lt
          calc (C (g x) * P.coeff 0).natDegree
              ≤ (C (g x)).natDegree + (P.coeff 0).natDegree := natDegree_mul_le
            _ = 0 + (P.coeff 0).natDegree := by simp
            _ ≤ s.card := by simpa using ih_deg 0
            _ < s.card + 1 := Nat.lt_succ_self _
        simp [h1, h2]
      | succ k =>
        rw [coeff_X_mul]
        have h1 : ((P - P₀).coeff k).coeff (s.card + 1 - (k + 1)) = 0 := by
          rw [show s.card + 1 - (k + 1) = s.card - k by omega]
          exact ih_top k (by omega)
        have h2 : (a₀ * (P.coeff (k + 1) - P₀.coeff (k + 1))).coeff (s.card + 1 - (k + 1)) = 0 := by
          by_cases hlt : s.card < k + 1
          · rw [ih_zero (k + 1) hlt, ih₀_zero (k + 1) hlt]
            simp
          · have hle : k + 1 ≤ s.card := by omega
            have heq : s.card + 1 - (k + 1) = (s.card - (k + 1)) + 1 := by omega
            rw [heq, show a₀ = C x * X from rfl, mul_assoc, coeff_C_mul, mul_comm X, coeff_mul_X]
            rw [← coeff_sub P P₀ (k + 1), ih_top (k + 1) hle, mul_zero]
        have h3 : (C (g x) * P.coeff (k + 1)).coeff (s.card + 1 - (k + 1)) = 0 := by
          by_cases hlt : s.card < k + 1
          · rw [ih_zero (k + 1) hlt, mul_zero, coeff_zero]
          · apply coeff_eq_zero_of_natDegree_lt
            calc (C (g x) * P.coeff (k + 1)).natDegree
                ≤ (C (g x)).natDegree + (P.coeff (k + 1)).natDegree := natDegree_mul_le
              _ = 0 + (P.coeff (k + 1)).natDegree := by simp
              _ ≤ s.card - (k + 1) := by simpa using ih_deg (k + 1)
              _ < s.card + 1 - (k + 1) := by omega
        rw [← coeff_sub P P₀ (k + 1)] at h2
        rw [coeff_add, h1, h2, h3]
        ring

private lemma prod_X_sub_C_pow_deriv_deg {p : ℕ} [Fact p.Prime]
    (I : Finset (ZMod p)) (k : ZMod p → ℕ) (g : (ZMod p)[X])
    (hg : g = ∏ y ∈ I, (X - C y) ^ k y)
    (hk_pos : ∀ y ∈ I, 1 ≤ k y) (hk_sum : ∑ y ∈ I, k y = p)
    (hderiv_ne : derivative g ≠ 0) :
    p - I.card ≤ (derivative g).natDegree := by
  have hdvd : (∏ y ∈ I, (X - C y) ^ (k y - 1)) ∣ derivative g := by
    refine Finset.prod_dvd_of_coprime (fun a _ b _ hab => ?_) fun y hy => ?_
    · exact (pairwise_coprime_X_sub_C Function.injective_id hab).pow
    · rw [hg, derivative_prod_finset]
      refine Finset.dvd_sum fun z hz => ?_
      by_cases hyz : y = z
      · subst hyz
        have hdy : (X - C y) ^ (k y - 1) ∣ derivative ((X - C y) ^ k y) := by
          rw [derivative_X_sub_C_pow]
          exact dvd_mul_left _ _
        exact dvd_mul_of_dvd_right hdy _
      · have hdvd_fac : (X - C y) ^ (k y - 1) ∣ (X - C y) ^ k y :=
          pow_dvd_pow _ (Nat.sub_le _ _)
        have hmem_erase : y ∈ I.erase z := Finset.mem_erase.mpr ⟨hyz, hy⟩
        have hprod_dvd : (X - C y) ^ k y ∣ ∏ w ∈ I.erase z, (X - C w) ^ k w :=
          Finset.dvd_prod_of_mem (fun w => (X - C w) ^ k w) hmem_erase
        exact dvd_mul_of_dvd_left (dvd_trans hdvd_fac hprod_dvd) (derivative ((X - C z) ^ k z))
  have hdeg_dvd : (∏ y ∈ I, (X - C y) ^ (k y - 1)).natDegree ≤ (derivative g).natDegree :=
    natDegree_le_of_dvd hdvd hderiv_ne
  have hdeg_prod : (∏ y ∈ I, (X - C y) ^ (k y - 1)).natDegree = p - I.card := by
    have hmon : ∀ y ∈ I, ((X - C y) ^ (k y - 1)).Monic := fun y _ => (monic_X_sub_C y).pow _
    rw [natDegree_prod_of_monic _ _ hmon]
    have hsum : ∑ y ∈ I, (k y - 1) + I.card = ∑ y ∈ I, k y := by
      calc ∑ y ∈ I, (k y - 1) + I.card
          = ∑ y ∈ I, (k y - 1) + ∑ _y ∈ I, 1 := by simp
        _ = ∑ y ∈ I, (k y - 1 + 1) := by rw [← Finset.sum_add_distrib]
        _ = ∑ y ∈ I, k y := Finset.sum_congr rfl fun y hy => Nat.sub_add_cancel (hk_pos y hy)
    calc ∑ y ∈ I, ((X - C y) ^ (k y - 1)).natDegree
        = ∑ y ∈ I, (k y - 1) := by
          refine Finset.sum_congr rfl fun y _ => ?_
          rw [natDegree_pow, natDegree_X_sub_C, mul_one]
      _ = p - I.card := by omega
  rwa [hdeg_prod] at hdeg_dvd

theorem problem2 (p : ℕ) [Fact p.Prime] (hp : 2 < p)
    (f : ZMod p → ZMod p)
    (hf : ¬ ∃ a b : ZMod p, ∀ x, f x = a * x + b) :
    p + 3 ≤ 2 * Set.ncard {m : ZMod p |
      ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} := by
  classical
  let D : Finset (ZMod p) :=
    Finset.univ.filter (fun m => ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y))
  have hset : {m : ZMod p | ∃ x y : ZMod p, x ≠ y ∧ f x - f y = m * (x - y)} = (D : Set (ZMod p)) := by
    ext m
    simp [D]
  rw [hset, Set.ncard_coe_finset]
  set d := D.card
  by_contra hlt
  push Not at hlt
  have hd_lt_p : d < p := by omega
  have hd_ge_two : 2 ≤ d := by
    by_contra hd2
    have hd_le_one : d ≤ 1 := by omega
    rcases Nat.le_one_iff_eq_zero_or_eq_one.mp hd_le_one with hd0 | hd1
    · have hD0 : D = ∅ := Finset.card_eq_zero.mp hd0
      have h01 : (0 : ZMod p) ≠ 1 := by
        intro h
        have hdvd : p ∣ 1 := by
          simpa using (ZMod.natCast_eq_zero_iff 1 p).mp (by simpa using h.symm)
        have := Nat.le_of_dvd Nat.one_pos hdvd
        omega
      have hm : f 1 - f 0 ∈ D := by
        simp only [D, Finset.mem_filter, Finset.mem_univ, true_and]
        exact ⟨1, 0, h01.symm, by ring⟩
      rw [hD0] at hm
      simp at hm
    · obtain ⟨m₀, hDm₀⟩ := Finset.card_eq_one.mp hd1
      apply hf
      refine ⟨m₀, f 0, fun x => ?_⟩
      by_cases hx : x = 0
      · subst hx; simp
      · have hm : (f x - f 0) / x ∈ D := by
          simp only [D, Finset.mem_filter, Finset.mem_univ, true_and]
          refine ⟨x, 0, hx, ?_⟩
          rw [sub_zero, div_mul_cancel₀ _ hx]
        rw [hDm₀, Finset.mem_singleton] at hm
        have hmul : f x - f 0 = m₀ * x := by
          rw [← hm, div_mul_cancel₀ _ hx]
        linear_combination hmul
  -- Define F, F₀, H, M
  let F : (ZMod p)[X][X] := ∏ x : ZMod p, (X + C (C x * X - C (f x)))
  let F₀ : (ZMod p)[X][X] := ∏ x : ZMod p, (X + C (C x * X))
  let H : (ZMod p)[X] := ∏ m ∈ Finset.univ \ D, (X - C m)
  let M : (ZMod p)[X] := ∏ m ∈ D, (X - C m)
  have hH_monic : H.Monic := monic_prod_of_monic _ _ fun m _ => monic_X_sub_C m
  have hM_monic : M.Monic := monic_prod_of_monic _ _ fun m _ => monic_X_sub_C m
  have hH_deg : H.natDegree = p - d := by
    rw [natDegree_finsetProd_X_sub_C_eq_card, Finset.card_sdiff_of_subset (Finset.subset_univ D),
      Finset.card_univ, ZMod.card p]
  have hHM : H * M = X ^ p - X := by
    calc H * M = ∏ m : ZMod p, (X - C m) := Finset.prod_sdiff (Finset.subset_univ D)
      _ = X ^ p - X := prod_univ_X_sub_C p
  -- Evaluation at m ∉ D gives X^p - X
  have hev_not_mem : ∀ m : ZMod p, m ∉ D → F.map (evalRingHom m) = X ^ p - X := by
    intro m hmD
    have hmap : F.map (evalRingHom m) = ∏ x : ZMod p, (X - C (f x - m * x)) := by
      simp only [F, Polynomial.map_prod, Polynomial.map_add, map_X, Polynomial.map_C,
        coe_evalRingHom, eval_sub, eval_mul, eval_C, eval_X]
      refine Finset.prod_congr rfl fun x _ => ?_
      calc X + C (x * m - f x)
          = X + C (-(f x - m * x)) := by congr 2; ring
        _ = X + -C (f x - m * x) := by rw [map_neg]
        _ = X - C (f x - m * x) := by rw [← sub_eq_add_neg]
    rw [hmap]
    have hinj : Function.Injective (fun x : ZMod p => f x - m * x) := by
      intro x y hxy
      by_contra hne
      apply hmD
      simp only [D, Finset.mem_filter, Finset.mem_univ, true_and]
      refine ⟨x, y, hne, ?_⟩
      linear_combination hxy
    have hbij : Function.Bijective (fun x : ZMod p => f x - m * x) :=
      (Fintype.bijective_iff_injective_and_card _).mpr ⟨hinj, rfl⟩
    calc (∏ x : ZMod p, (X - C (f x - m * x)))
        = ∏ y : ZMod p, (X - C y) := by
          refine Finset.prod_bij (fun x _ => f x - m * x) (fun _ _ => Finset.mem_univ _)
            (fun _ _ _ _ h => hinj h) (fun y _ => ?_) (fun _ _ => rfl)
          obtain ⟨x, hx⟩ := hbij.2 y
          exact ⟨x, Finset.mem_univ _, hx⟩
      _ = X ^ p - X := prod_univ_X_sub_C p
  -- Hence H divides every coefficient of F - (X^p - X)
  let R : (ZMod p)[X][X] := F - (X ^ p - X)
  have hH_dvd_coeff : ∀ k : ℕ, H ∣ R.coeff k := by
    intro k
    have hroot : ∀ m ∈ Finset.univ \ D, X - C m ∣ R.coeff k := by
      intro m hm
      rw [Finset.mem_sdiff] at hm
      rw [dvd_iff_isRoot, IsRoot.def]
      have h0 : (R.map (evalRingHom m)).coeff k = 0 := by
        have hmapR : R.map (evalRingHom m) = 0 := by
          simp only [R, Polynomial.map_sub, Polynomial.map_pow, map_X, hev_not_mem m hm.2, sub_self]
        simp [hmapR]
      simpa [coeff_map] using h0
    refine Finset.prod_dvd_of_coprime (fun a _ b _ hab => ?_) hroot
    exact pairwise_coprime_X_sub_C Function.injective_id hab
  -- Construct Q with R = C H * Q
  let q_fun : ℕ → (ZMod p)[X] := fun k => Classical.choose (hH_dvd_coeff k)
  have hq_fun : ∀ k, R.coeff k = H * q_fun k := fun k =>
    Classical.choose_spec (hH_dvd_coeff k)
  let Q : (ZMod p)[X][X] := ∑ k ∈ R.support, monomial k (q_fun k)
  have hRQ : R = C H * Q := by
    calc R = R.sum (fun k c => monomial k c) := (sum_monomial_eq R).symm
      _ = ∑ k ∈ R.support, monomial k (H * q_fun k) := by
          refine Finset.sum_congr rfl fun k _ => ?_
          rw [hq_fun k]
      _ = ∑ k ∈ R.support, C H * monomial k (q_fun k) := by
          refine Finset.sum_congr rfl fun k _ => (C_mul_monomial).symm
      _ = C H * Q := by rw [Finset.mul_sum]
  -- Compute F₀ = X^p - X * C (X^(p-1))
  have hF_bounds := bivariate_prod_coeff_bounds f Finset.univ
  have hF₀_bounds := bivariate_prod_coeff_bounds (fun _ : ZMod p => (0 : ZMod p)) Finset.univ
  have hF₀_eq : F₀ = X ^ p - X * C (X ^ (p - 1)) := by
    have hF₀_def : F₀ = ∏ x : ZMod p, (X + C (C x * X - C 0)) := by
      simp [F₀]
    apply Polynomial.ext
    intro k
    by_cases hk0 : k = 0
    · subst hk0
      have hdvd0 : (X : (ZMod p)[X][X]) ∣ F₀ := by
        dsimp only [F₀]
        have hmem : (0 : ZMod p) ∈ (Finset.univ : Finset (ZMod p)) := Finset.mem_univ _
        rw [← Finset.mul_prod_erase Finset.univ _ hmem]
        simp only [zero_mul, map_zero, add_zero]
        exact dvd_mul_right _ _
      obtain ⟨P, hP⟩ := hdvd0
      have hp0 : (0 : ℕ) < p := by omega
      rw [hP, coeff_X_mul_zero, coeff_sub, coeff_X_pow]
      split_ifs with h
      · exact absurd h hp0.ne
      · rw [coeff_X_mul_zero, sub_zero]
    · by_cases hkp : p < k
      · rw [hF₀_def] at *
        have hz := hF₀_bounds.2.1 k (by simpa [ZMod.card p] using hkp)
        rw [hz, coeff_sub, coeff_X_pow]
        split_ifs with h
        · omega
        · rw [zero_sub, eq_comm, neg_eq_zero]
          cases k with
          | zero => contradiction
          | succ k' =>
            rw [coeff_X_mul, coeff_C]
            split_ifs with h0
            · omega
            · rfl
      · have hk1 : 1 ≤ k := Nat.pos_of_ne_zero hk0
        have hk_le_p : k ≤ p := le_of_not_gt hkp
        have hdeg_lhs : (F₀.coeff k).natDegree < p := by
          rw [hF₀_def]
          have hle := hF₀_bounds.1 k
          simp only [Finset.card_univ, ZMod.card p] at hle
          omega
        have hdeg_rhs : (((X ^ p - X * C (X ^ (p - 1)) : (ZMod p)[X][X]).coeff k)).natDegree < p := by
          rw [coeff_sub, coeff_X_pow]
          split_ifs with h1
          · have hp_ge2 : 2 ≤ p := by omega
            have hxk : (X * C (X ^ (p - 1)) : (ZMod p)[X][X]).coeff k = 0 := by
              cases k with
              | zero => omega
              | succ k' =>
                rw [coeff_X_mul, coeff_C]
                split_ifs with h0
                · omega
                · rfl
            rw [hxk, sub_zero, natDegree_one]
            omega
          · rw [zero_sub, natDegree_neg]
            cases k with
            | zero => contradiction
            | succ k' =>
              rw [coeff_X_mul, coeff_C]
              split_ifs <;> (simp; omega)
        have hdiff_deg : (F₀.coeff k - (X ^ p - X * C (X ^ (p - 1)) : (ZMod p)[X][X]).coeff k).natDegree < p :=
          (natDegree_sub_le _ _).trans_lt (max_lt hdeg_lhs hdeg_rhs)
        apply sub_eq_zero.mp
        refine eq_zero_of_natDegree_lt_of_forall_eval_zero hdiff_deg fun m => ?_
        rw [eval_sub, sub_eq_zero]
        have hev_lhs : (F₀.coeff k).eval m = (F₀.map (evalRingHom m)).coeff k := by
          rw [coeff_map]; rfl
        have hev_rhs : ((X ^ p - X * C (X ^ (p - 1)) : (ZMod p)[X][X]).coeff k).eval m =
            ((X ^ p - X * C (X ^ (p - 1)) : (ZMod p)[X][X]).map (evalRingHom m)).coeff k := by
          rw [coeff_map]; rfl
        rw [hev_lhs, hev_rhs]
        refine congrArg (fun P : (ZMod p)[X] => P.coeff k) ?_
        simp only [F₀, Polynomial.map_prod, Polynomial.map_add, Polynomial.map_sub,
          Polynomial.map_mul, Polynomial.map_pow, map_X, Polynomial.map_C, coe_evalRingHom,
          eval_mul, eval_C, eval_X, eval_pow]
        by_cases hm0 : m = 0
        · subst hm0
          have hp_sub : p - 1 ≠ 0 := by omega
          simp [zero_pow hp_sub, Finset.card_univ, ZMod.card p]
        · have hm_pow : m ^ (p - 1) = 1 := by
            have := FiniteField.pow_card_sub_one_eq_one m hm0
            simpa [ZMod.card p] using this
          rw [hm_pow, C_1, mul_one]
          have hbij : Function.Bijective (fun x : ZMod p => -(x * m)) := by
            refine (Fintype.bijective_iff_injective_and_card _).mpr ⟨fun x y hxy => ?_, rfl⟩
            have : x * m = y * m := neg_inj.mp hxy
            exact mul_right_cancel₀ hm0 this
          calc (∏ x : ZMod p, (X + C (x * m)))
              = ∏ y : ZMod p, (X - C y) := by
                refine Finset.prod_bij (fun x _ => -(x * m)) (fun _ _ => Finset.mem_univ _)
                  (fun _ _ _ _ h => hbij.1 h) (fun y _ => ?_) (fun x _ => by simp [sub_eq_add_neg])
                obtain ⟨x, hx⟩ := hbij.2 y
                exact ⟨x, Finset.mem_univ _, hx⟩
            _ = X ^ p - X := prod_univ_X_sub_C p
  -- Deduce properties of Q
  have hQ_coeff1_deg : (Q.coeff 1).natDegree = d - 1 := by
    have hR1 : R.coeff 1 = H * Q.coeff 1 := by
      have := congrArg (fun P : (ZMod p)[X][X] => P.coeff 1) hRQ
      simpa [coeff_C_mul] using this
    have hF1_deg : (R.coeff 1).natDegree = p - 1 := by
      have hdeg_le : (R.coeff 1).natDegree ≤ p - 1 := by
        have hF_le : (F.coeff 1).natDegree ≤ p - 1 := by
          simpa [F, ZMod.card p] using hF_bounds.1 1
        have hTp : ((X ^ p - X : (ZMod p)[X][X]).coeff 1).natDegree = 0 := by
          rw [coeff_sub, coeff_X_pow]
          split_ifs with h
          · omega
          · rw [zero_sub, coeff_X_one, natDegree_neg, natDegree_one]
        rw [coeff_sub]
        exact (natDegree_sub_le _ _).trans (max_le hF_le (by rw [hTp]; exact Nat.zero_le _))
      have hcoeff_ne : (R.coeff 1).coeff (p - 1) ≠ 0 := by
        have htop := hF_bounds.2.2 1 (by simp [ZMod.card p]; omega)
        simp only [Finset.card_univ, ZMod.card p] at htop
        have hF₀1 : (F₀.coeff 1).coeff (p - 1) = -1 := by
          rw [hF₀_eq, coeff_sub, coeff_X_pow]
          split_ifs with h
          · omega
          · rw [zero_sub, show (1 : ℕ) = 0 + 1 from rfl, coeff_X_mul, coeff_C]
            simp [coeff_neg, coeff_X_pow]
        have hTp1 : (((X ^ p - X : (ZMod p)[X][X]).coeff 1)).coeff (p - 1) = 0 := by
          rw [coeff_sub, coeff_X_pow]
          split_ifs with h
          · omega
          · rw [zero_sub, coeff_X_one]
            have : p - 1 ≠ 0 := by omega
            simp [coeff_neg, coeff_one, this]
        have hF1 : (F.coeff 1).coeff (p - 1) = -1 := by
          change ((F - F₀).coeff 1).coeff (p - 1) = 0 at htop
          rw [coeff_sub, coeff_sub, sub_eq_zero] at htop
          rw [htop, hF₀1]
        rw [show R.coeff 1 = F.coeff 1 - (X ^ p - X : (ZMod p)[X][X]).coeff 1 from coeff_sub _ _ 1,
          coeff_sub, hF1, hTp1, sub_zero]
        exact neg_ne_zero.mpr one_ne_zero
      have hge : p - 1 ≤ (R.coeff 1).natDegree := le_natDegree_of_ne_zero hcoeff_ne
      omega
    have hQ1_ne : Q.coeff 1 ≠ 0 := by
      intro h0
      rw [h0, mul_zero] at hR1
      rw [hR1, natDegree_zero] at hF1_deg
      omega
    rw [hR1, hH_monic.natDegree_mul' hQ1_ne, hH_deg] at hF1_deg
    omega
  have hQ_deg : ∀ k, d ≤ k → Q.coeff k = 0 := by
    intro k hk
    have hRk : R.coeff k = H * Q.coeff k := by
      have := congrArg (fun P : (ZMod p)[X][X] => P.coeff k) hRQ
      simpa [coeff_C_mul] using this
    have hRk_deg : R.coeff k = 0 ∨ (R.coeff k).natDegree < p - d := by
      by_cases hkp : p < k
      · left
        have hz := hF_bounds.2.1 k (by simpa [ZMod.card p] using hkp)
        rw [show R.coeff k = F.coeff k - (X ^ p - X : (ZMod p)[X][X]).coeff k from coeff_sub _ _ k,
          hz, coeff_sub, coeff_X_pow, coeff_X]
        split_ifs <;> first | omega | simp
      · by_cases hkeqp : k = p
        · left
          have hFp : F.coeff p = 1 := by
            have hprod : F.Monic := monic_prod_of_monic _ _ fun x _ => monic_X_add_C _
            have hdeg : F.natDegree = p := by
              calc F.natDegree = ∑ x : ZMod p, (X + C (C x * X - C (f x)) : (ZMod p)[X][X]).natDegree :=
                    natDegree_prod_of_monic _ _ fun x _ => monic_X_add_C _
                _ = ∑ _x : ZMod p, 1 := Finset.sum_congr rfl fun x _ => natDegree_X_add_C _
                _ = p := by simp [ZMod.card p]
            have hlc := hprod.leadingCoeff
            rw [leadingCoeff, hdeg] at hlc
            exact hlc
          rw [hkeqp,
            show R.coeff p = F.coeff p - (X ^ p - X : (ZMod p)[X][X]).coeff p from coeff_sub _ _ p,
            hFp, coeff_sub, coeff_X_pow, coeff_X]
          split_ifs <;> first | omega | simp
        · right
          have hk_lt_p : k < p := by omega
          have hTp : ((X ^ p - X : (ZMod p)[X][X]).coeff k) = 0 := by
            rw [coeff_sub, coeff_X_pow, coeff_X]
            split_ifs <;> first | omega | simp
          rw [show R.coeff k = F.coeff k - (X ^ p - X : (ZMod p)[X][X]).coeff k from coeff_sub _ _ k,
            hTp, sub_zero]
          have hF_le : (F.coeff k).natDegree ≤ p - k := by
            simpa [F, ZMod.card p] using hF_bounds.1 k
          by_cases hk_eq_d : k = d
          · rw [hk_eq_d] at hF_le hk_lt_p ⊢
            have htop := hF_bounds.2.2 d (by simp [ZMod.card p]; omega)
            simp only [Finset.card_univ, ZMod.card p] at htop
            have hF₀d : (F₀.coeff d).coeff (p - d) = 0 := by
              rw [hF₀_eq, coeff_sub, coeff_X_pow]
              split_ifs with h
              · omega
              · rw [zero_sub, coeff_neg]
                obtain ⟨d', hd'⟩ := Nat.exists_eq_succ_of_ne_zero (by omega : d ≠ 0)
                rw [hd', coeff_X_mul, coeff_C]
                split_ifs with h0
                · omega
                · simp
            have hFd_top : (F.coeff d).coeff (p - d) = 0 := by
              change ((F - F₀).coeff d).coeff (p - d) = 0 at htop
              rw [coeff_sub, coeff_sub, sub_eq_zero] at htop
              rw [htop, hF₀d]
            have hF_ne_deg : (F.coeff d).natDegree ≠ p - d := by
              intro hEq
              by_cases h0 : F.coeff d = 0
              · rw [h0, natDegree_zero] at hEq; omega
              · have := leadingCoeff_ne_zero.mpr h0
                rw [leadingCoeff, hEq] at this
                exact this hFd_top
            omega
          · omega
    by_contra hQ0
    have hdeg_mul : (R.coeff k).natDegree = H.natDegree + (Q.coeff k).natDegree := by
      rw [hRk, hH_monic.natDegree_mul' hQ0]
    rcases hRk_deg with h0 | hltdeg
    · rw [h0] at hRk
      exact hQ0 ((mul_eq_zero.mp hRk.symm).resolve_left hH_monic.ne_zero)
    · rw [hH_deg] at hdeg_mul
      omega
  -- Pick m ∈ D such that (Q.coeff 1).eval m ≠ 0
  have hQ1_ne : Q.coeff 1 ≠ 0 := by
    intro h0
    rw [h0, natDegree_zero] at hQ_coeff1_deg
    omega
  have hex_m : ∃ m ∈ D, (Q.coeff 1).eval m ≠ 0 := by
    by_contra! hall
    have hsub : D ⊆ (Q.coeff 1).roots.toFinset := by
      intro m hm
      rw [Multiset.mem_toFinset, mem_roots hQ1_ne, IsRoot.def]
      exact hall m hm
    have := calc d = D.card := rfl
      _ ≤ (Q.coeff 1).roots.toFinset.card := Finset.card_le_card hsub
      _ ≤ Multiset.card (Q.coeff 1).roots := Multiset.toFinset_card_le _
      _ ≤ (Q.coeff 1).natDegree := (Q.coeff 1).card_roots'
      _ = d - 1 := hQ_coeff1_deg
    omega
  obtain ⟨m, hmD, hmQ1⟩ := hex_m
  let q_m : (ZMod p)[X] := Q.map (evalRingHom m)
  have hqm_ne : q_m ≠ 0 := by
    intro h0
    have := congrArg (fun P : (ZMod p)[X] => P.coeff 1) h0
    simp [q_m, coeff_map] at this
    exact hmQ1 this
  have hqm_deg : q_m.natDegree ≤ d - 1 := by
    rw [natDegree_le_iff_coeff_eq_zero]
    intro k hk
    simp only [q_m, coeff_map, coe_evalRingHom]
    rw [hQ_deg k (by omega), eval_zero]
  -- Evaluate Q at T = C (f x) - X * C x to get q_m.eval (f x - m * x) = 0
  have hqm_root : ∀ x : ZMod p, q_m.eval (f x - m * x) = 0 := by
    intro x
    let v : (ZMod p)[X] := C (f x) - X * C x
    have hFv : F.eval v = 0 := by
      rw [eval_prod]
      exact Finset.prod_eq_zero (Finset.mem_univ x) (by simp [v])
    have hRv : R.eval v = -(v ^ p - v) := by
      simp [R, hFv]
    have hvpv : v ^ p - v = - C x * (H * M) := by
      have hchar : CharP (ZMod p)[X] p := Polynomial.charP
      have hv1 : (C (f x) - X * C x) ^ p = (C (f x)) ^ p - (X * C x) ^ p :=
        sub_pow_char (C (f x)) (X * C x)
      have hv2 : (C (f x)) ^ p = C (f x) := by
        rw [← map_pow, ZMod.pow_card]
      have hv3 : (X * C x) ^ p = X ^ p * C x := by
        rw [mul_pow, ← map_pow, ZMod.pow_card]
      rw [show v = C (f x) - X * C x from rfl, hv1, hv2, hv3, hHM]
      ring
    have hHQv : H * Q.eval v = H * (C x * M) := by
      have h1 : R.eval v = H * Q.eval v := by
        rw [hRQ, eval_mul, eval_C]
      rw [h1] at hRv
      rw [hRv, hvpv]
      ring
    have hQv : Q.eval v = C x * M := mul_left_cancel₀ hH_monic.ne_zero hHQv
    have hM_eval : M.eval m = 0 := by
      rw [eval_prod]
      exact Finset.prod_eq_zero hmD (by simp)
    have heval_qm : q_m.eval (v.eval m) = (Q.eval v).eval m := by
      rw [eval_map]
      change Q.eval₂ (evalRingHom m) (v.eval m) = (evalRingHom m) (Q.eval₂ (RingHom.id _) v)
      rw [hom_eval₂]
      rfl
    have hv_eval : v.eval m = f x - m * x := by
      simp [v, mul_comm m x]
    rw [← hv_eval, heval_qm, hQv, eval_mul, eval_C, hM_eval, mul_zero]
  -- Image I_m
  let I_m : Finset (ZMod p) := Finset.univ.image (fun x => f x - m * x)
  have hIm_le : I_m.card ≤ d - 1 := by
    have hsub : I_m ⊆ q_m.roots.toFinset := by
      intro y hy
      rw [Finset.mem_image] at hy
      obtain ⟨x, _, rfl⟩ := hy
      rw [Multiset.mem_toFinset, mem_roots hqm_ne, IsRoot.def]
      exact hqm_root x
    calc I_m.card ≤ q_m.roots.toFinset.card := Finset.card_le_card hsub
      _ ≤ Multiset.card q_m.roots := Multiset.toFinset_card_le _
      _ ≤ q_m.natDegree := q_m.card_roots'
      _ ≤ d - 1 := hqm_deg
  -- Now inspect f_m = F.map (evalRingHom m)
  let f_m : (ZMod p)[X] := F.map (evalRingHom m)
  have hfm_eq1 : f_m = X ^ p - X + C (H.eval m) * q_m := by
    have := congrArg (Polynomial.map (evalRingHom m)) hRQ
    simp only [R, Polynomial.map_sub, Polynomial.map_pow, map_X, Polynomial.map_mul,
      Polynomial.map_C, coe_evalRingHom] at this
    change f_m - (X ^ p - X) = C (H.eval m) * q_m at this
    linear_combination this
  have hfm_deriv_deg : (derivative f_m).natDegree ≤ d - 2 := by
    have hXp : derivative (X ^ p : (ZMod p)[X]) = 0 := by
      rw [derivative_X_pow]
      simp [CharP.cast_eq_zero]
    rw [hfm_eq1, derivative_add, derivative_sub, hXp, zero_sub, derivative_X,
      derivative_mul, derivative_C, zero_mul, zero_add]
    refine (natDegree_add_le _ _).trans (max_le (by simp) ?_)
    calc (C (H.eval m) * derivative q_m).natDegree
        ≤ (C (H.eval m)).natDegree + (derivative q_m).natDegree := natDegree_mul_le
      _ = 0 + (derivative q_m).natDegree := by simp
      _ ≤ q_m.natDegree - 1 := by simpa using natDegree_derivative_le (p := q_m)
      _ ≤ d - 2 := by omega
  have hfm_prod : f_m = ∏ x : ZMod p, (X - C (f x - m * x)) := by
    simp only [f_m, F, Polynomial.map_prod, Polynomial.map_add, map_X, Polynomial.map_C,
      coe_evalRingHom, eval_sub, eval_mul, eval_C, eval_X]
    refine Finset.prod_congr rfl fun x _ => ?_
    calc X + C (x * m - f x)
        = X + C (-(f x - m * x)) := by congr 2; ring
      _ = X + -C (f x - m * x) := by rw [map_neg]
      _ = X - C (f x - m * x) := by rw [← sub_eq_add_neg]
  let k : ZMod p → ℕ := fun y => (Finset.univ.filter (fun x => f x - m * x = y)).card
  have hfm_prod_fiber : f_m = ∏ y ∈ I_m, (X - C y) ^ k y := by
    rw [hfm_prod]
    rw [← Finset.prod_fiberwise_of_maps_to (g := fun x => f x - m * x)
      (fun x _ => Finset.mem_image_of_mem _ (Finset.mem_univ x))]
    refine Finset.prod_congr rfl fun y _ => ?_
    calc ∏ x ∈ Finset.univ.filter (fun x => f x - m * x = y), (X - C (f x - m * x))
        = ∏ _x ∈ Finset.univ.filter (fun x => f x - m * x = y), (X - C y) :=
          Finset.prod_congr rfl fun x hx => by rw [(Finset.mem_filter.mp hx).2]
      _ = (X - C y) ^ k y := Finset.prod_const _
  have hk_sum : ∑ y ∈ I_m, k y = p := by
    calc ∑ y ∈ I_m, k y
        = ∑ y ∈ I_m, (Finset.univ.filter (fun x : ZMod p => f x - m * x = y)).card := rfl
      _ = (Finset.univ : Finset (ZMod p)).card := by
          rw [← Finset.card_eq_sum_card_fiberwise]
          intro x _
          exact Finset.mem_image_of_mem _ (Finset.mem_univ x)
      _ = p := ZMod.card p
  have hk_pos : ∀ y ∈ I_m, 1 ≤ k y := by
    intro y hy
    rw [Finset.mem_image] at hy
    obtain ⟨x, _, rfl⟩ := hy
    exact Finset.card_pos.mpr ⟨x, Finset.mem_filter.mpr ⟨Finset.mem_univ _, rfl⟩⟩
  have hk_lt_p : ∀ y ∈ I_m, k y < p := by
    intro y hy
    by_contra hge
    have hkeq : k y = p := by
      have hle : k y ≤ p := (Finset.card_filter_le _ _).trans_eq (by rw [Finset.card_univ, ZMod.card p])
      omega
    have hfilter : Finset.univ.filter (fun x : ZMod p => f x - m * x = y) = Finset.univ := by
      apply Finset.eq_univ_of_card
      change k y = _
      rw [hkeq, ZMod.card p]
    apply hf
    refine ⟨m, y, fun x => ?_⟩
    have hx := Finset.mem_filter.mp (hfilter ▸ Finset.mem_univ x)
    linear_combination hx.2
  have hIm_ge_two : 2 ≤ I_m.card := by
    by_contra hle
    rcases Nat.le_one_iff_eq_zero_or_eq_one.mp (Nat.lt_succ_iff.mp (Nat.not_le.mp hle)) with h0 | h1
    · have := Finset.card_eq_zero.mp h0
      rw [this, Finset.sum_empty] at hk_sum
      omega
    · obtain ⟨y₀, hy₀⟩ := Finset.card_eq_one.mp h1
      rw [hy₀, Finset.sum_singleton] at hk_sum
      have := hk_lt_p y₀ (by rw [hy₀]; exact Finset.mem_singleton_self y₀)
      omega
  have hderiv_ne : derivative f_m ≠ 0 := by
    intro h0
    have hfm_monic : f_m.Monic := by
      rw [hfm_prod]
      exact monic_prod_of_monic _ _ fun x _ => monic_X_sub_C _
    have hfm_deg : f_m.natDegree = p := by
      rw [hfm_prod, natDegree_finsetProd_X_sub_C_eq_card, Finset.card_univ, ZMod.card p]
    have hcoeff_zero : ∀ n, 0 < n → n < p → f_m.coeff n = 0 := by
      intro n hn0 hnp
      have hdn : (derivative f_m).coeff (n - 1) = 0 := by rw [h0, coeff_zero]
      rw [coeff_derivative] at hdn
      have hcast_eq : ((n - 1 : ℕ) : ZMod p) + 1 = (n : ZMod p) := by
        rw [← Nat.cast_succ, show (n - 1).succ = n by omega]
      have hn_eq : n - 1 + 1 = n := by omega
      rw [hn_eq, hcast_eq] at hdn
      have hn_cast : ((n : ℕ) : ZMod p) ≠ 0 := by
        intro hcast
        rw [ZMod.natCast_eq_zero_iff] at hcast
        have := Nat.le_of_dvd hn0 hcast
        omega
      exact (mul_eq_zero.mp hdn).resolve_right hn_cast
    have hfm_simp : f_m = X ^ p + C (f_m.coeff 0) := by
      apply Polynomial.ext
      intro n
      by_cases hn0 : n = 0
      · subst hn0
        rw [coeff_add, coeff_X_pow, coeff_C]
        split_ifs <;> first | omega | simp
      · by_cases hnp : n < p
        · rw [hcoeff_zero n (Nat.pos_of_ne_zero hn0) hnp, coeff_add, coeff_X_pow, coeff_C]
          split_ifs <;> first | omega | simp
        · by_cases hnep : n = p
          · have hfp : f_m.coeff p = 1 := by
              have hlc := hfm_monic.leadingCoeff
              rw [leadingCoeff, hfm_deg] at hlc
              exact hlc
            rw [hnep, hfp, coeff_add, coeff_X_pow, coeff_C]
            split_ifs <;> first | omega | simp
          · have hgt : f_m.natDegree < n := by omega
            rw [coeff_eq_zero_of_natDegree_lt hgt, coeff_add, coeff_X_pow, coeff_C]
            split_ifs
            simp
    have hpow : f_m = (X + C (f_m.coeff 0)) ^ p := by
      have hchar : CharP (ZMod p)[X] p := Polynomial.charP
      rw [add_pow_char, ← map_pow, ZMod.pow_card]
      exact hfm_simp
    have hcard_roots : I_m.card ≤ 1 := by
      have : ∀ y ∈ I_m, y = -(f_m.coeff 0) := by
        intro y hy
        have hroot : f_m.eval y = 0 := by
          rw [hfm_prod, eval_prod]
          rw [Finset.mem_image] at hy
          obtain ⟨x, _, rfl⟩ := hy
          exact Finset.prod_eq_zero (Finset.mem_univ x) (by simp)
        rw [hpow, eval_pow, eval_add, eval_X, eval_C] at hroot
        have := eq_zero_of_pow_eq_zero hroot
        linear_combination this
      have hsub : I_m ⊆ {-(f_m.coeff 0)} := fun y hy => Finset.mem_singleton.mpr (this y hy)
      exact (Finset.card_le_card hsub).trans_eq (Finset.card_singleton _)
    omega
  have hdeg_dvd := prod_X_sub_C_pow_deriv_deg I_m k f_m hfm_prod_fiber hk_pos hk_sum hderiv_ne
  omega
