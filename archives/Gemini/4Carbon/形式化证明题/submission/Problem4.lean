import Mathlib.Algebra.BigOperators.Field
import Mathlib.Data.Finset.Max
import Mathlib.Data.Finset.Powerset
import Mathlib.Data.Rat.Cast.Order
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.Ring

section Problem4Aux

private lemma bernoulli_aux (m : ℕ) (s : ℚ) (hs : s ≤ 1) :
    (1 + (m : ℚ) * s) * (1 - s) ^ m ≤ 1 := by
  induction m with
  | zero => simp
  | succ m ih =>
    have h1s : 0 ≤ 1 - s := by linarith
    have hpow : 0 ≤ (1 - s) ^ m := pow_nonneg h1s m
    have hstep : (1 + ((m + 1 : ℕ) : ℚ) * s) * (1 - s) ≤ 1 + (m : ℚ) * s := by
      push_cast
      have hsq : 0 ≤ ((m : ℚ) + 1) * (s * s) :=
        mul_nonneg (by positivity) (mul_self_nonneg s)
      linarith [show (1 + ((m : ℚ) + 1) * s) * (1 - s) =
        (1 + (m : ℚ) * s) - ((m : ℚ) + 1) * (s * s) by ring]
    calc (1 + ((m + 1 : ℕ) : ℚ) * s) * (1 - s) ^ (m + 1)
        = ((1 + ((m + 1 : ℕ) : ℚ) * s) * (1 - s)) * (1 - s) ^ m := by
          rw [pow_succ]
          ring
      _ ≤ (1 + (m : ℚ) * s) * (1 - s) ^ m := mul_le_mul_of_nonneg_right hstep hpow
      _ ≤ 1 := ih

private lemma am_gm_rat {ι : Type*} (S : Finset ι) (x : ι → ℚ) (hx : ∀ i ∈ S, 0 ≤ x i) :
    (S.card : ℚ) ^ S.card * (∏ i ∈ S, x i) ≤ (∑ i ∈ S, x i) ^ S.card := by
  induction S using Finset.cons_induction with
  | empty => simp
  | cons a T ha ih =>
    rw [Finset.card_cons, Finset.prod_cons, Finset.sum_cons]
    let m := T.card
    change ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * ∏ i ∈ T, x i) ≤
      (x a + ∑ i ∈ T, x i) ^ (m + 1)
    have hxa : 0 ≤ x a := hx a (Finset.mem_cons_self a T)
    have hxT : ∀ i ∈ T, 0 ≤ x i := fun i hi => hx i (Finset.mem_cons_of_mem hi)
    have ih' : (m : ℚ) ^ m * (∏ i ∈ T, x i) ≤ (∑ i ∈ T, x i) ^ m := ih hxT
    by_cases hm0 : m = 0
    · have hT_empty : T = ∅ := Finset.card_eq_zero.mp hm0
      subst hT_empty
      dsimp only [m]
      simp
    · have hm_pos : (0 : ℚ) < (m : ℚ) := Nat.cast_pos.mpr (Nat.pos_of_ne_zero hm0)
      have hm1_pos : (0 : ℚ) < ((m + 1 : ℕ) : ℚ) := by positivity
      let sumT := ∑ i ∈ T, x i
      have hsumT_nonneg : 0 ≤ sumT := Finset.sum_nonneg hxT
      let sumS := x a + sumT
      by_cases hsumS0 : sumS = 0
      · have hxa0 : x a = 0 := by linarith
        change ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * ∏ i ∈ T, x i) ≤ sumS ^ (m + 1)
        rw [hxa0, hsumS0]
        simp
      · have hsumS_pos : 0 < sumS := lt_of_le_of_ne (by linarith) (Ne.symm hsumS0)
        let A := sumS / ((m + 1 : ℕ) : ℚ)
        have hA_pos : 0 < A := div_pos hsumS_pos hm1_pos
        let B := sumT / (m : ℚ)
        have hB_nonneg : 0 ≤ B := div_nonneg hsumT_nonneg hm_pos.le
        let s := 1 - B / A
        have hs_le1 : s ≤ 1 := by
          dsimp only [s]
          linarith [div_nonneg hB_nonneg hA_pos.le]
        have hm1A : ((m + 1 : ℕ) : ℚ) * A = sumS := mul_div_cancel₀ sumS hm1_pos.ne'
        have hmB : (m : ℚ) * B = sumT := mul_div_cancel₀ sumT hm_pos.ne'
        have hAs : A * s = A - B := by
          dsimp only [s]
          rw [mul_sub, mul_one, mul_div_cancel₀ B hA_pos.ne']
        have h1ms : B = A * (1 - s) := by
          rw [mul_sub, mul_one, hAs]
          ring
        have h1pms : x a = A * (1 + (m : ℚ) * s) := by
          have hexp : A * (1 + (m : ℚ) * s) = A + (m : ℚ) * (A * s) := by ring
          have hm1A' : ((m : ℚ) + 1) * A = x a + sumT := by
            simpa [Nat.cast_add, Nat.cast_one] using hm1A
          rw [hexp, hAs]
          linarith [show ((m : ℚ) + 1) * A = A + (m : ℚ) * A by ring,
            show (m : ℚ) * (A - B) = (m : ℚ) * A - (m : ℚ) * B by ring]
        have hprodT : ∏ i ∈ T, x i ≤ B ^ m := by
          dsimp only [B]
          rw [div_pow, le_div_iff₀ (pow_pos hm_pos m)]
          linarith [show (∏ i ∈ T, x i) * (m : ℚ) ^ m = (m : ℚ) ^ m * (∏ i ∈ T, x i) by ring]
        have h_lhs_le : ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * ∏ i ∈ T, x i) ≤
            ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * B ^ m) :=
          mul_le_mul_of_nonneg_left (mul_le_mul_of_nonneg_left hprodT hxa) (pow_nonneg hm1_pos.le _)
        calc ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * ∏ i ∈ T, x i)
            ≤ ((m + 1 : ℕ) : ℚ) ^ (m + 1) * (x a * B ^ m) := h_lhs_le
          _ = (((m + 1 : ℕ) : ℚ) * A) ^ (m + 1) * ((1 + (m : ℚ) * s) * (1 - s) ^ m) := by
              rw [h1pms, h1ms]
              simp only [pow_succ, mul_pow]
              ring
          _ ≤ (((m + 1 : ℕ) : ℚ) * A) ^ (m + 1) * 1 :=
              mul_le_mul_of_nonneg_left (bernoulli_aux m s hs_le1)
                (pow_nonneg (mul_nonneg hm1_pos.le hA_pos.le) _)
          _ = sumS ^ (m + 1) := by rw [hm1A, mul_one]

private lemma prod_two_pow_rat {ι : Type*} (S : Finset ι) (d : ι → ℕ) :
    (∏ i ∈ S, (2 : ℚ) ^ (d i)) = (2 : ℚ) ^ (∑ i ∈ S, d i) := by
  induction S using Finset.cons_induction with
  | empty => simp
  | cons a T ha ih =>
    rw [Finset.prod_cons, Finset.sum_cons, pow_add, ih]

private lemma biUnion_mem_of_union_closed {α : Type*} [DecidableEq α]
    (A S : Finset (Finset α)) (hSA : S ⊆ A) (hS : S.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    S.biUnion id ∈ A := by
  induction S using Finset.cons_induction with
  | empty => exact False.elim (Finset.not_nonempty_empty hS)
  | cons x T hx ih =>
    rcases T.eq_empty_or_nonempty with rfl | hT
    · simp only [Finset.cons_empty, Finset.singleton_biUnion, id_eq]
      exact hSA (Finset.mem_cons_self x ∅)
    · rw [Finset.cons_eq_insert, Finset.biUnion_insert, id_eq]
      exact hunion x (hSA (Finset.mem_cons_self x T)) (T.biUnion id)
        (ih (Finset.Subset.trans (Finset.subset_cons hx) hSA) hT)

private lemma problem4_aux {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (_hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  let U : Finset α := A.biUnion id
  let n : ℕ := U.card
  let F : Finset α → Finset (Finset α) := fun a =>
    U.powerset.filter (fun z => a ⊆ z ∧ ∀ b ∈ A, b ⊆ z → b ⊆ a)
  have ha_sub_U : ∀ a ∈ A, a ⊆ U := fun a ha => Finset.subset_biUnion_of_mem id ha
  have ha_mem_F : ∀ a ∈ A, a ∈ F a := by
    intro a ha
    simp only [F, Finset.mem_filter, Finset.mem_powerset]
    exact ⟨ha_sub_U a ha, Finset.Subset.refl a, fun _ _ hba => hba⟩
  have hF_nonempty : ∀ a ∈ A, (F a).Nonempty := fun a ha => ⟨a, ha_mem_F a ha⟩
  have hF_disj : ∀ a₁ ∈ A, ∀ a₂ ∈ A, ∀ z, z ∈ F a₁ → z ∈ F a₂ → a₁ = a₂ := by
    intro a₁ ha₁ a₂ ha₂ z hz₁ hz₂
    simp only [F, Finset.mem_filter] at hz₁ hz₂
    exact Finset.Subset.antisymm (hz₂.2.2 a₁ ha₁ hz₁.2.1) (hz₁.2.2 a₂ ha₂ hz₂.2.1)
  have hF_interval : ∀ a ∈ A, ∀ y ∈ F a, ∀ z, a ⊆ z → z ⊆ y → z ∈ F a := by
    intro a _ y hy z haz hzy
    simp only [F, Finset.mem_filter, Finset.mem_powerset] at hy ⊢
    exact ⟨Finset.Subset.trans hzy hy.1, haz, fun b hb hbz => hy.2.2 b hb (Finset.Subset.trans hbz hzy)⟩
  let y : Finset α → Finset α := fun a =>
    if ha : a ∈ A then ((F a).exists_max_image Finset.card (hF_nonempty a ha)).choose else ∅
  have hy_spec : ∀ a ∈ A, y a ∈ F a ∧ ∀ z ∈ F a, z.card ≤ (y a).card := by
    intro a ha
    have hspec := ((F a).exists_max_image Finset.card (hF_nonempty a ha)).choose_spec
    simpa only [y, ha, ↓reduceDIte] using hspec
  have hy_mem_F : ∀ a ∈ A, y a ∈ F a := fun a ha => (hy_spec a ha).1
  have hy_max : ∀ a ∈ A, ∀ z ∈ F a, z.card ≤ (y a).card := fun a ha => (hy_spec a ha).2
  have hy_sub_U : ∀ a ∈ A, y a ⊆ U := by
    intro a ha
    have h := hy_mem_F a ha
    simp only [F, Finset.mem_filter, Finset.mem_powerset] at h
    exact h.1
  have ha_sub_y : ∀ a ∈ A, a ⊆ y a := by
    intro a ha
    have h := hy_mem_F a ha
    simp only [F, Finset.mem_filter] at h
    exact h.2.1
  let I : Finset α → Finset (Finset α) := fun a =>
    (y a \ a).powerset.image (fun w => a ∪ w)
  have hI_sub_F : ∀ a ∈ A, I a ⊆ F a := by
    intro a ha z hz
    rcases Finset.mem_image.mp hz with ⟨w, hw, rfl⟩
    have hw_sub : w ⊆ y a \ a := Finset.mem_powerset.mp hw
    have hw_sub_y : w ⊆ y a := Finset.Subset.trans hw_sub Finset.sdiff_subset
    exact hF_interval a ha (y a) (hy_mem_F a ha) (a ∪ w) Finset.subset_union_left
      (Finset.union_subset (ha_sub_y a ha) hw_sub_y)
  have hI_card : ∀ a ∈ A, (I a).card = 2 ^ ((y a).card - a.card) := by
    intro a ha
    dsimp only [I]
    have hinj : Set.InjOn (fun w => a ∪ w) ((y a \ a).powerset : Set (Finset α)) := by
      intro w₁ hw₁ w₂ hw₂ heq
      dsimp only at heq
      have hd₁ : Disjoint a w₁ :=
        Finset.disjoint_of_subset_right (Finset.mem_powerset.mp hw₁) disjoint_sdiff_self_right
      have hd₂ : Disjoint a w₂ :=
        Finset.disjoint_of_subset_right (Finset.mem_powerset.mp hw₂) disjoint_sdiff_self_right
      have h1 : (a ∪ w₁) \ a = w₁ := Finset.union_sdiff_cancel_left hd₁
      have h2 : (a ∪ w₂) \ a = w₂ := Finset.union_sdiff_cancel_left hd₂
      rw [← h1, ← h2, heq]
    rw [Finset.card_image_of_injOn hinj, Finset.card_powerset]
    have hunion_eq : a ∪ (y a \ a) = y a := Finset.union_sdiff_of_subset (ha_sub_y a ha)
    have hdisj_ay : Disjoint a (y a \ a) := disjoint_sdiff_self_right
    have hcard_eq : a.card + (y a \ a).card = (y a).card := by
      rw [← Finset.card_union_of_disjoint hdisj_ay, hunion_eq]
    have : (y a \ a).card = (y a).card - a.card := by omega
    rw [this]
  have hI_pw_disj : (A : Set (Finset α)).PairwiseDisjoint I := by
    intro a₁ ha₁ a₂ ha₂ hne
    rw [Function.onFun, Finset.disjoint_left]
    intro z hz₁ hz₂
    exact hne (hF_disj a₁ ha₁ a₂ ha₂ z (hI_sub_F a₁ ha₁ hz₁) (hI_sub_F a₂ ha₂ hz₂))
  have hbiUnion_sub : A.biUnion I ⊆ U.powerset := by
    intro z hz
    rcases Finset.mem_biUnion.mp hz with ⟨a, ha, hza⟩
    have hzF := hI_sub_F a ha hza
    simp only [F, Finset.mem_filter] at hzF
    exact hzF.1
  have hkraft : (∑ a ∈ A, 2 ^ ((y a).card - a.card)) ≤ 2 ^ n := by
    calc (∑ a ∈ A, 2 ^ ((y a).card - a.card))
        = ∑ a ∈ A, (I a).card := Finset.sum_congr rfl fun a ha => (hI_card a ha).symm
      _ = (A.biUnion I).card := (Finset.card_biUnion hI_pw_disj).symm
      _ ≤ U.powerset.card := Finset.card_le_card hbiUnion_sub
      _ = 2 ^ n := Finset.card_powerset U
  let S : α → Finset (Finset α) := fun i => A.filter (fun a => i ∉ y a)
  let T : α → Finset (Finset α) := fun i => A.filter (fun b => i ∈ b)
  have hcard_ST : ∀ i ∈ U, (S i).card ≤ (T i).card := by
    intro i hiU
    let B : Finset α → Finset (Finset α) := fun a =>
      A.filter (fun b => b ⊆ insert i (y a))
    let φ : Finset α → Finset α := fun a => (B a).biUnion id
    have hB_nonempty : ∀ a ∈ S i, (B a).Nonempty := by
      intro a haS
      have haA : a ∈ A := (Finset.mem_filter.mp haS).1
      refine ⟨a, Finset.mem_filter.mpr ⟨haA, ?_⟩⟩
      exact Finset.Subset.trans (ha_sub_y a haA) (Finset.subset_insert i (y a))
    have hφ_mem_A : ∀ a ∈ S i, φ a ∈ A := by
      intro a haS
      exact biUnion_mem_of_union_closed A (B a) (Finset.filter_subset _ A)
        (hB_nonempty a haS) hunion
    have ha_sub_φ : ∀ a ∈ S i, a ⊆ φ a := by
      intro a haS
      have haA : a ∈ A := (Finset.mem_filter.mp haS).1
      have haB : a ∈ B a := Finset.mem_filter.mpr ⟨haA,
        Finset.Subset.trans (ha_sub_y a haA) (Finset.subset_insert i (y a))⟩
      exact Finset.subset_biUnion_of_mem id haB
    have hφ_sub_ins : ∀ a ∈ S i, φ a ⊆ insert i (y a) := by
      intro a _
      refine Finset.biUnion_subset.mpr fun b hb => ?_
      exact (Finset.mem_filter.mp hb).2
    have hφ_maps : ∀ a ∈ S i, φ a ∈ T i := by
      intro a haS
      rcases Finset.mem_filter.mp haS with ⟨haA, hi_not_ya⟩
      refine Finset.mem_filter.mpr ⟨hφ_mem_A a haS, ?_⟩
      by_contra hi_not_φ
      have hφ_sub_ya : φ a ⊆ y a := by
        intro x hx
        have hx_ins : x ∈ insert i (y a) := hφ_sub_ins a haS hx
        rcases Finset.mem_insert.mp hx_ins with rfl | hx_ya
        · exact False.elim (hi_not_φ hx)
        · exact hx_ya
      have hφ_sub_a : φ a ⊆ a := by
        have hyF := hy_mem_F a haA
        simp only [F, Finset.mem_filter] at hyF
        exact hyF.2.2 (φ a) (hφ_mem_A a haS) hφ_sub_ya
      have hins_mem_F : insert i (y a) ∈ F a := by
        simp only [F, Finset.mem_filter, Finset.mem_powerset]
        refine ⟨Finset.insert_subset hiU (hy_sub_U a haA),
          Finset.Subset.trans (ha_sub_y a haA) (Finset.subset_insert i (y a)), ?_⟩
        intro b hbA hb_sub
        have hbB : b ∈ B a := Finset.mem_filter.mpr ⟨hbA, hb_sub⟩
        exact Finset.Subset.trans (Finset.subset_biUnion_of_mem id hbB) hφ_sub_a
      have hcard_le := hy_max a haA (insert i (y a)) hins_mem_F
      rw [Finset.card_insert_of_notMem hi_not_ya] at hcard_le
      omega
    have hφ_inj : Set.InjOn φ (S i : Set (Finset α)) := by
      intro a₁ ha₁ a₂ ha₂ heq
      rcases Finset.mem_filter.mp ha₁ with ⟨ha₁A, _⟩
      rcases Finset.mem_filter.mp ha₂ with ⟨ha₂A, _⟩
      let b := φ a₁
      let z := b.erase i
      have hz_mem : ∀ a ∈ S i, φ a = b → z ∈ F a := by
        intro a haS hφeq
        rcases Finset.mem_filter.mp haS with ⟨haA, hi_not_ya⟩
        have ha_sub_b : a ⊆ b := hφeq ▸ ha_sub_φ a haS
        have hb_sub_ins : b ⊆ insert i (y a) := hφeq ▸ hφ_sub_ins a haS
        have ha_sub_z : a ⊆ z := by
          intro x hx
          refine Finset.mem_erase.mpr ⟨?_, ha_sub_b hx⟩
          intro hxi
          subst hxi
          exact hi_not_ya (ha_sub_y a haA hx)
        have hz_sub_ya : z ⊆ y a := by
          intro x hx
          rcases Finset.mem_erase.mp hx with ⟨hx_ne, hxb⟩
          rcases Finset.mem_insert.mp (hb_sub_ins hxb) with rfl | hx_ya
          · exact False.elim (hx_ne rfl)
          · exact hx_ya
        exact hF_interval a haA (y a) (hy_mem_F a haA) z ha_sub_z hz_sub_ya
      exact hF_disj a₁ ha₁A a₂ ha₂A z (hz_mem a₁ ha₁ rfl) (hz_mem a₂ ha₂ heq.symm)
    have himg_sub : (S i).image φ ⊆ T i := by
      intro b hb
      rcases Finset.mem_image.mp hb with ⟨a, haS, rfl⟩
      exact hφ_maps a haS
    rw [← Finset.card_image_of_injOn hφ_inj]
    exact Finset.card_le_card himg_sub
  have hsum_S : (∑ i ∈ U, (S i).card) = ∑ a ∈ A, (n - (y a).card) := by
    have h1 : ∀ i, (S i).card = ∑ a ∈ A, if i ∉ y a then 1 else 0 := by
      intro i
      dsimp only [S]
      rw [Finset.card_filter]
    simp_rw [h1]
    rw [Finset.sum_comm]
    refine Finset.sum_congr rfl fun a ha => ?_
    rw [← Finset.card_filter]
    have hsub : y a ⊆ U := hy_sub_U a ha
    have hfilt_eq : U.filter (fun i => i ∈ y a) = y a := by
      ext i
      simp only [Finset.mem_filter]
      exact ⟨fun h => h.2, fun h => ⟨hsub h, h⟩⟩
    have hunion_U : U.filter (fun i => i ∈ y a) ∪ U.filter (fun i => i ∉ y a) = U := by
      ext i
      simp only [Finset.mem_union, Finset.mem_filter]
      by_cases hi : i ∈ y a <;> simp [hi]
    have hdisj_U : Disjoint (U.filter (fun i => i ∈ y a)) (U.filter (fun i => i ∉ y a)) := by
      rw [Finset.disjoint_left]
      intro i h1 h2
      exact (Finset.mem_filter.mp h2).2 (Finset.mem_filter.mp h1).2
    have hcard_U : (U.filter (fun i => i ∈ y a)).card + (U.filter (fun i => i ∉ y a)).card = n := by
      rw [← Finset.card_union_of_disjoint hdisj_U, hunion_U]
    rw [hfilt_eq] at hcard_U
    omega
  have hsum_T : (∑ i ∈ U, (T i).card) = ∑ a ∈ A, a.card := by
    have h1 : ∀ i, (T i).card = ∑ a ∈ A, if i ∈ a then 1 else 0 := by
      intro i
      dsimp only [T]
      rw [Finset.card_filter]
    simp_rw [h1]
    rw [Finset.sum_comm]
    refine Finset.sum_congr rfl fun a ha => ?_
    rw [← Finset.card_filter]
    have hsub : a ⊆ U := ha_sub_U a ha
    have hfilt_eq : U.filter (fun i => i ∈ a) = a := by
      ext i
      simp only [Finset.mem_filter]
      exact ⟨fun h => h.2, fun h => ⟨hsub h, h⟩⟩
    rw [hfilt_eq]
  have hsum_compl_le : (∑ a ∈ A, (n - (y a).card)) ≤ ∑ a ∈ A, a.card := by
    rw [← hsum_S, ← hsum_T]
    exact Finset.sum_le_sum hcard_ST
  let d : Finset α → ℕ := fun a => (y a).card - a.card
  have hd_le_n : ∀ a ∈ A, d a ≤ n := by
    intro a ha
    have : (y a).card ≤ n := Finset.card_le_card (hy_sub_U a ha)
    dsimp only [d]
    omega
  have hsum_nd_le : (∑ a ∈ A, (n - d a)) ≤ 2 * ∑ a ∈ A, a.card := by
    have hterm : ∀ a ∈ A, n - d a = (n - (y a).card) + a.card := by
      intro a ha
      have h1 : a.card ≤ (y a).card := Finset.card_le_card (ha_sub_y a ha)
      have h2 : (y a).card ≤ n := Finset.card_le_card (hy_sub_U a ha)
      dsimp only [d]
      omega
    rw [Finset.sum_congr rfl hterm, Finset.sum_add_distrib, two_mul]
    exact Nat.add_le_add_right hsum_compl_le _
  have hamgm := am_gm_rat A (fun a => (2 : ℚ) ^ (d a)) (fun _ _ => by positivity)
  rw [prod_two_pow_rat] at hamgm
  have hkraft_rat : (∑ a ∈ A, (2 : ℚ) ^ (d a)) ≤ (2 : ℚ) ^ n := by
    exact_mod_cast hkraft
  have hpow_le : (∑ a ∈ A, (2 : ℚ) ^ (d a)) ^ A.card ≤ ((2 : ℚ) ^ n) ^ A.card :=
    pow_le_pow_left₀ (Finset.sum_nonneg fun _ _ => by positivity) hkraft_rat A.card
  have hn_mul : n * A.card = (∑ a ∈ A, (n - d a)) + (∑ a ∈ A, d a) := by
    rw [← Finset.sum_add_distrib]
    have hterm : ∀ a ∈ A, (n - d a) + d a = n := fun a ha => Nat.sub_add_cancel (hd_le_n a ha)
    rw [Finset.sum_congr rfl hterm, Finset.sum_const, Nat.nsmul_eq_mul, mul_comm]
  have hcomb_rat : (A.card : ℚ) ^ A.card * (2 : ℚ) ^ (∑ a ∈ A, d a) ≤
      (2 : ℚ) ^ (∑ a ∈ A, (n - d a)) * (2 : ℚ) ^ (∑ a ∈ A, d a) := by
    calc (A.card : ℚ) ^ A.card * (2 : ℚ) ^ (∑ a ∈ A, d a)
        ≤ (∑ a ∈ A, (2 : ℚ) ^ (d a)) ^ A.card := hamgm
      _ ≤ ((2 : ℚ) ^ n) ^ A.card := hpow_le
      _ = (2 : ℚ) ^ (n * A.card) := (pow_mul (2 : ℚ) n A.card).symm
      _ = (2 : ℚ) ^ ((∑ a ∈ A, (n - d a)) + (∑ a ∈ A, d a)) := by rw [hn_mul]
      _ = (2 : ℚ) ^ (∑ a ∈ A, (n - d a)) * (2 : ℚ) ^ (∑ a ∈ A, d a) := pow_add _ _ _
  have hpos_pow : (0 : ℚ) < (2 : ℚ) ^ (∑ a ∈ A, d a) := by positivity
  have hle1 : (A.card : ℚ) ^ A.card ≤ (2 : ℚ) ^ (∑ a ∈ A, (n - d a)) :=
    le_of_mul_le_mul_right hcomb_rat hpos_pow
  have hle2 : (2 : ℚ) ^ (∑ a ∈ A, (n - d a)) ≤ (2 : ℚ) ^ (2 * ∑ a ∈ A, a.card) :=
    pow_le_pow_right₀ (by norm_num) hsum_nd_le
  have hfinal_rat : (A.card : ℚ) ^ A.card ≤ (2 : ℚ) ^ (2 * ∑ a ∈ A, a.card) :=
    le_trans hle1 hle2
  exact_mod_cast hfinal_rat

end Problem4Aux

theorem problem4 {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  exact problem4_aux A hA hunion
