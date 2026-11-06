import Mathlib.Analysis.SpecialFunctions.Log.Basic
import Mathlib.Analysis.Convex.SpecificFunctions.Basic
import Mathlib.Data.Finset.Powerset
import Mathlib.Algebra.BigOperators.Field

open Finset

namespace P3

lemma log_one_add_ge (t : ℝ) (ht0 : 0 ≤ t) (ht1 : t ≤ 1) :
    t * Real.log 2 ≤ Real.log (1 + t) := by
  have h := (strictConcaveOn_log_Ioi.concaveOn).2 (by norm_num : (1:ℝ) ∈ Set.Ioi 0)
    (by norm_num : (2:ℝ) ∈ Set.Ioi 0) (by linarith : (0:ℝ) ≤ 1 - t) ht0 (by ring)
  simp only [smul_eq_mul, Real.log_one, mul_zero, zero_add, mul_one] at h
  have e : 1 - t + t * 2 = 1 + t := by ring
  rw [e] at h
  exact h

lemma key_ineq (a b : ℝ) (hb : 0 ≤ b) (hba : b ≤ a) :
    a * Real.log a + b * Real.log b + 2 * Real.log 2 * b ≤ (a + b) * Real.log (a + b) := by
  rcases hb.eq_or_lt with h | h
  · subst h; simp
  have ha : 0 < a := lt_of_lt_of_le h hba
  have h1 : Real.log (a + b) = Real.log a + Real.log (1 + b / a) := by
    rw [← Real.log_mul ha.ne' (by positivity)]; congr 1; field_simp
  have h2 : b / a * Real.log 2 ≤ Real.log (1 + b / a) :=
    log_one_add_ge (b / a) (by positivity) (by rw [div_le_one ha]; exact hba)
  have h3 : Real.log 2 + Real.log b ≤ Real.log (a + b) := by
    rw [← Real.log_mul (by norm_num) h.ne']
    exact Real.log_le_log (by positivity) (by linarith)
  have h4 : a * (b / a * Real.log 2) = b * Real.log 2 := by field_simp
  have h5 := mul_le_mul_of_nonneg_left h2 ha.le
  have h6 := mul_le_mul_of_nonneg_left h3 hb
  calc a * Real.log a + b * Real.log b + 2 * Real.log 2 * b
      = a * Real.log a + a * (b / a * Real.log 2) + b * (Real.log 2 + Real.log b) := by
        rw [h4]; ring
    _ ≤ a * Real.log a + a * Real.log (1 + b / a) + b * Real.log (a + b) := by linarith
    _ = (a + b) * Real.log (a + b) := by rw [h1]; ring

variable {α : Type*} [DecidableEq α]

lemma downset_bound_aux (V : Finset α) : ∀ D : Finset (Finset α), (∀ S ∈ D, S ⊆ V) →
    (∀ S ∈ D, ∀ x ∈ S, S.erase x ∈ D) →
    2 * Real.log 2 * (∑ S ∈ D, (S.card : ℝ)) ≤ (D.card : ℝ) * Real.log D.card := by
  induction V using Finset.induction_on with
  | empty =>
    intro D hV _
    have h : ∀ S ∈ D, (S.card : ℝ) = 0 := fun S hS => by
      rw [Nat.cast_eq_zero, Finset.card_eq_zero]; exact Finset.subset_empty.mp (hV S hS)
    rw [Finset.sum_congr rfl h, Finset.sum_const_zero, mul_zero]
    exact mul_nonneg (Nat.cast_nonneg _) (Real.log_natCast_nonneg _)
  | insert x V hx ih =>
    intro D hV hD
    set D0 := D.filter (fun S => x ∉ S) with hD0
    set D1' := D.filter (fun S => x ∈ S) with hD1'
    set D1 := D1'.image (fun S => S.erase x) with hD1
    have hinj : Set.InjOn (fun S : Finset α => S.erase x) D1' := by
      intro S hS T hT hST
      simp only [hD1', Finset.coe_filter, Set.mem_setOf_eq] at hS hT
      have := congrArg (insert x) hST
      simp only at this
      rwa [Finset.insert_erase hS.2, Finset.insert_erase hT.2] at this
    have hcard1 : D1.card = D1'.card := Finset.card_image_of_injOn hinj
    have hsum1 : ∑ S ∈ D1', (S.card : ℝ) = ∑ T ∈ D1, (T.card : ℝ) + D1.card := by
      rw [hD1, Finset.sum_image hinj, hcard1, Finset.card_eq_sum_ones, Nat.cast_sum,
        ← Finset.sum_add_distrib]
      apply Finset.sum_congr rfl
      intro S hS
      rw [Finset.mem_filter] at hS
      rw [← Finset.card_erase_add_one hS.2]
      push_cast; ring
    have hD0V : ∀ S ∈ D0, S ⊆ V := by
      intro S hS
      rw [Finset.mem_filter] at hS
      intro y hy
      have := hV S hS.1 hy
      rw [Finset.mem_insert] at this
      rcases this with h | h
      · subst h; exact absurd hy hS.2
      · exact h
    have hD1V : ∀ S ∈ D1, S ⊆ V := by
      intro T hT
      rw [Finset.mem_image] at hT
      obtain ⟨S, hS, rfl⟩ := hT
      rw [Finset.mem_filter] at hS
      intro y hy
      rw [Finset.mem_erase] at hy
      have := hV S hS.1 hy.2
      rw [Finset.mem_insert] at this
      rcases this with h | h
      · exact absurd h hy.1
      · exact h
    have hD0d : ∀ S ∈ D0, ∀ y ∈ S, S.erase y ∈ D0 := by
      intro S hS y hy
      rw [Finset.mem_filter] at hS ⊢
      exact ⟨hD S hS.1 y hy, fun h => hS.2 (Finset.mem_of_mem_erase h)⟩
    have hD1d : ∀ S ∈ D1, ∀ y ∈ S, S.erase y ∈ D1 := by
      intro T hT y hy
      rw [Finset.mem_image] at hT ⊢
      obtain ⟨S, hS, rfl⟩ := hT
      rw [Finset.mem_filter] at hS
      have hyx : y ≠ x := (Finset.mem_erase.mp hy).1
      have hyS : y ∈ S := (Finset.mem_erase.mp hy).2
      refine ⟨S.erase y, ?_, ?_⟩
      · rw [Finset.mem_filter]
        exact ⟨hD S hS.1 y hyS, Finset.mem_erase.mpr ⟨Ne.symm hyx, hS.2⟩⟩
      · exact Finset.erase_right_comm
    have hsub : D1 ⊆ D0 := by
      intro T hT
      rw [Finset.mem_image] at hT
      obtain ⟨S, hS, rfl⟩ := hT
      rw [Finset.mem_filter] at hS ⊢
      exact ⟨hD S hS.1 x hS.2, Finset.notMem_erase x S⟩
    have ih0 := ih D0 hD0V hD0d
    have ih1 := ih D1 hD1V hD1d
    have hle : (D1.card : ℝ) ≤ D0.card := by exact_mod_cast Finset.card_le_card hsub
    have hDcard : (D.card : ℝ) = D0.card + D1.card := by
      rw [hcard1]
      have := Finset.card_filter_add_card_filter_not (s := D) (fun S => x ∉ S)
      simp only [not_not] at this
      rw [← this]; push_cast; ring
    have hDsum : ∑ S ∈ D, (S.card : ℝ) = ∑ S ∈ D0, (S.card : ℝ) + ∑ T ∈ D1, (T.card : ℝ)
        + D1.card := by
      rw [add_assoc, ← hsum1]
      have := Finset.sum_filter_add_sum_filter_not D (fun S => x ∉ S) (fun S => (S.card : ℝ))
      simp only [not_not] at this
      rw [← this]
    have hk := key_ineq (D0.card : ℝ) (D1.card : ℝ) (Nat.cast_nonneg _) hle
    rw [hDsum, hDcard]
    have e : 2 * Real.log 2 * (∑ S ∈ D0, (S.card : ℝ) + ∑ T ∈ D1, (T.card : ℝ) + D1.card)
        = 2 * Real.log 2 * ∑ S ∈ D0, (S.card : ℝ) + 2 * Real.log 2 * ∑ T ∈ D1, (T.card : ℝ)
          + 2 * Real.log 2 * D1.card := by ring
    rw [e]
    linarith

lemma downset_bound (D : Finset (Finset α)) (hD : ∀ S ∈ D, ∀ x ∈ S, S.erase x ∈ D) :
    2 * Real.log 2 * (∑ S ∈ D, (S.card : ℝ)) ≤ (D.card : ℝ) * Real.log D.card :=
  downset_bound_aux (D.sup id) D (fun S hS => Finset.le_sup (f := id) hS) hD

/-- the largest member of `F` contained in `S` -/
def mx (F : Finset (Finset α)) (S : Finset α) : Finset α := (F.filter (· ⊆ S)).sup id

/-- the fibre of `mx` over `A` -/
def fib (F : Finset (Finset α)) (A : Finset α) : Finset (Finset α) :=
  ((F.sup id).powerset).filter (fun S => mx F S = A)

lemma sup_mem_of_uc (F : Finset (Finset α)) (h0 : ∅ ∈ F)
    (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F) (T : Finset (Finset α)) (hT : T ⊆ F) :
    T.sup id ∈ F := by
  induction T using Finset.induction_on with
  | empty => simpa using h0
  | insert a T ha ih =>
    rw [Finset.sup_insert, id, Finset.sup_eq_union]
    exact hU a (hT (Finset.mem_insert_self a T)) _
      (ih (fun b hb => hT (Finset.mem_insert_of_mem hb)))

lemma mx_mem (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F)
    (S : Finset α) : mx F S ∈ F :=
  sup_mem_of_uc F h0 hU _ (Finset.filter_subset _ _)

lemma mx_subset (F : Finset (Finset α)) (S : Finset α) : mx F S ⊆ S :=
  Finset.sup_le (fun B hB => (Finset.mem_filter.mp hB).2)

lemma le_mx (F : Finset (Finset α)) {B S : Finset α} (hB : B ∈ F) (hBS : B ⊆ S) :
    B ⊆ mx F S :=
  Finset.le_sup (f := id) (Finset.mem_filter.mpr ⟨hB, hBS⟩)

lemma mx_mono (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F)
    {S T : Finset α} (h : S ⊆ T) : mx F S ⊆ mx F T :=
  le_mx F (mx_mem F h0 hU S) ((mx_subset F S).trans h)

lemma mx_self (F : Finset (Finset α)) {A : Finset α} (hA : A ∈ F) : mx F A = A :=
  Finset.Subset.antisymm (mx_subset F A) (le_mx F hA Finset.Subset.rfl)

lemma mem_fib (F : Finset (Finset α)) (A S : Finset α) :
    S ∈ fib F A ↔ S ⊆ F.sup id ∧ mx F S = A := by
  unfold fib
  rw [Finset.mem_filter, Finset.mem_powerset]

lemma self_mem_fib (F : Finset (Finset α)) {A : Finset α} (hA : A ∈ F) : A ∈ fib F A :=
  (mem_fib F A A).mpr ⟨Finset.le_sup (f := id) hA, mx_self F hA⟩

lemma fib_sub (F : Finset (Finset α)) {A S : Finset α} (hS : S ∈ fib F A) : A ⊆ S := by
  rw [mem_fib] at hS
  rw [← hS.2]; exact mx_subset F S

lemma fib_erase (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F)
    {A S : Finset α} (hA : A ∈ F) (hS : S ∈ fib F A) {y : α} (hy : y ∉ A) :
    S.erase y ∈ fib F A := by
  have hAS := fib_sub F hS
  rw [mem_fib] at hS ⊢
  refine ⟨(Finset.erase_subset y S).trans hS.1, ?_⟩
  apply Finset.Subset.antisymm
  · rw [← hS.2]; exact mx_mono F h0 hU (Finset.erase_subset y S)
  · apply le_mx F hA
    intro z hz
    exact Finset.mem_erase.mpr ⟨fun h => hy (h ▸ hz), hAS hz⟩

lemma fib_card_pos (F : Finset (Finset α)) {A : Finset α} (hA : A ∈ F) :
    0 < (fib F A).card := Finset.card_pos.mpr ⟨A, self_mem_fib F hA⟩

/-- edge bound inside a fibre -/
lemma fib_bound (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F)
    {A : Finset α} (hA : A ∈ F) :
    2 * Real.log 2 * (∑ S ∈ fib F A, (S.card : ℝ)) ≤
      2 * Real.log 2 * ((fib F A).card * A.card)
        + ((fib F A).card : ℝ) * Real.log (fib F A).card := by
  set D := (fib F A).image (fun S => S \ A) with hD
  have hinj : Set.InjOn (fun S => S \ A) (fib F A : Set (Finset α)) := by
    intro S hS T hT hST
    simp only at hST
    have h1 := Finset.sdiff_union_of_subset (fib_sub F (Finset.mem_coe.mp hS))
    have h2 := Finset.sdiff_union_of_subset (fib_sub F (Finset.mem_coe.mp hT))
    rw [← h1, ← h2, hST]
  have hDcard : D.card = (fib F A).card := Finset.card_image_of_injOn hinj
  have hDdown : ∀ T ∈ D, ∀ y ∈ T, T.erase y ∈ D := by
    intro T hT y hy
    rw [Finset.mem_image] at hT ⊢
    obtain ⟨S, hS, rfl⟩ := hT
    have hyA : y ∉ A := (Finset.mem_sdiff.mp hy).2
    refine ⟨S.erase y, fib_erase F h0 hU hA hS hyA, ?_⟩
    ext z
    simp only [Finset.mem_sdiff, Finset.mem_erase]
    tauto
  have hb := downset_bound D hDdown
  rw [hDcard, hD, Finset.sum_image hinj] at hb
  have hs : ∑ S ∈ fib F A, ((S \ A).card : ℝ) =
      ∑ S ∈ fib F A, (S.card : ℝ) - (fib F A).card * A.card := by
    rw [Finset.card_eq_sum_ones (fib F A), Nat.cast_sum, Finset.sum_mul, ← Finset.sum_sub_distrib]
    apply Finset.sum_congr rfl
    intro S hS
    rw [Finset.card_sdiff_of_subset (fib_sub F hS),
      Nat.cast_sub (Finset.card_le_card (fib_sub F hS))]
    simp
  rw [hs] at hb
  nlinarith

/-- the marginal lemma -/
lemma marginal (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F)
    {x : α} (hx : x ∈ F.sup id) :
    (F.card : ℝ) / 2 ≤ ∑ A ∈ F, ((((fib F A).filter (fun S => x ∈ S)).card : ℝ)
      / (fib F A).card) := by
  set F1 := F.filter (fun A => x ∈ A) with hF1
  set F0 := F.filter (fun A => x ∉ A) with hF0
  set Bad := F1.image (fun B => mx F (B.erase x)) with hBad
  set r : Finset α → ℝ := fun A => (((fib F A).filter (fun S => x ∈ S)).card : ℝ)
      / (fib F A).card with hr
  have hr1 : ∀ A ∈ F1, r A = 1 := by
    intro A hA
    rw [Finset.mem_filter] at hA
    have hpos : (0 : ℝ) < (fib F A).card := by exact_mod_cast fib_card_pos F hA.1
    have : (fib F A).filter (fun S => x ∈ S) = fib F A := by
      apply Finset.filter_true_of_mem
      intro S hS
      exact fib_sub F hS hA.2
    simp only [hr, this]
    exact div_self hpos.ne'
  have hr0 : ∀ A ∈ F0, (if A ∈ Bad then (0 : ℝ) else 1 / 2) ≤ r A := by
    intro A hA
    rw [Finset.mem_filter] at hA
    have hpos : (0 : ℝ) < (fib F A).card := by exact_mod_cast fib_card_pos F hA.1
    split_ifs with hbad
    · exact div_nonneg (Nat.cast_nonneg _) hpos.le
    · -- bijection between sets with and without x
      set P := (fib F A).filter (fun S => x ∈ S) with hP
      set Q := (fib F A).filter (fun S => x ∉ S) with hQ
      have hPQ : P.card = Q.card := by
        apply Finset.card_nbij' (fun S => S.erase x) (fun T => insert x T)
        · intro S hS
          simp only [hP, Finset.coe_filter, Set.mem_setOf_eq] at hS
          simp only [hQ, Finset.coe_filter, Set.mem_setOf_eq]
          exact ⟨fib_erase F h0 hU hA.1 hS.1 hA.2, Finset.notMem_erase x S⟩
        · intro T hT
          simp only [hQ, Finset.coe_filter, Set.mem_setOf_eq] at hT
          simp only [hP, Finset.coe_filter, Set.mem_setOf_eq]
          refine ⟨?_, Finset.mem_insert_self x T⟩
          have hTA := fib_sub F hT.1
          rw [mem_fib] at hT ⊢
          refine ⟨Finset.insert_subset hx hT.1.1, ?_⟩
          by_contra hne
          apply hbad
          set B := mx F (insert x T) with hB
          have hBF : B ∈ F := mx_mem F h0 hU _
          have hAB : A ⊆ B := le_mx F hA.1 (hTA.trans (Finset.subset_insert x T))
          have hxB : x ∈ B := by
            by_contra hxB
            apply hne
            apply Finset.Subset.antisymm _ hAB
            have hBT : B ⊆ T := by
              intro z hz
              have := mx_subset F (insert x T) hz
              rw [Finset.mem_insert] at this
              rcases this with h | h
              · subst h; exact absurd hz hxB
              · exact h
            rw [← hT.1.2]
            exact le_mx F hBF hBT
          rw [Finset.mem_image]
          refine ⟨B, Finset.mem_filter.mpr ⟨hBF, hxB⟩, ?_⟩
          apply Finset.Subset.antisymm
          · rw [← hT.1.2]
            apply mx_mono F h0 hU
            intro z hz
            rw [Finset.mem_erase] at hz
            have := mx_subset F (insert x T) hz.2
            rw [Finset.mem_insert] at this
            rcases this with h | h
            · exact absurd h hz.1
            · exact h
          · apply le_mx F hA.1
            intro z hz
            exact Finset.mem_erase.mpr ⟨fun h => hA.2 (h ▸ hz), hAB hz⟩
        · intro S hS
          simp only [hP, Finset.coe_filter, Set.mem_setOf_eq] at hS
          exact Finset.insert_erase hS.2
        · intro T hT
          simp only [hQ, Finset.coe_filter, Set.mem_setOf_eq] at hT
          exact Finset.erase_insert hT.2
      have htot : (fib F A).card = P.card + Q.card := by
        rw [hP, hQ]
        exact (Finset.card_filter_add_card_filter_not _).symm
      simp only [hr]
      rw [← hP, htot, ← hPQ]
      have hPpos : (0 : ℝ) < P.card := by
        have : (0 : ℝ) < (fib F A).card := hpos
        rw [htot, ← hPQ] at this
        push_cast at this
        linarith
      push_cast
      rw [le_div_iff₀ (by linarith)]
      linarith
  have hsplit := Finset.sum_filter_add_sum_filter_not F (fun A => x ∈ A) r
  have hsum1 : ∑ A ∈ F1, r A = F1.card := by
    rw [Finset.sum_congr rfl hr1]; simp
  have hsum0 : ∑ A ∈ F0, (if A ∈ Bad then (0 : ℝ) else 1 / 2) ≤ ∑ A ∈ F0, r A :=
    Finset.sum_le_sum hr0
  have hite : ∑ A ∈ F0, (if A ∈ Bad then (0 : ℝ) else 1 / 2)
      = (1 / 2) * (F0.filter (fun A => A ∉ Bad)).card := by
    rw [Finset.sum_ite, Finset.sum_const_zero, zero_add, Finset.sum_const, nsmul_eq_mul]
    ring
  have hc1 : (F0.filter (fun A => A ∈ Bad)).card ≤ F1.card := by
    calc (F0.filter (fun A => A ∈ Bad)).card ≤ Bad.card := by
          apply Finset.card_le_card
          intro A hA
          exact (Finset.mem_filter.mp hA).2
      _ ≤ F1.card := Finset.card_image_le
  have hc2 := Finset.card_filter_add_card_filter_not (s := F0) (fun A => A ∈ Bad)
  have hc3 := Finset.card_filter_add_card_filter_not (s := F) (fun A => x ∈ A)
  have hc1' : ((F0.filter (fun A => A ∈ Bad)).card : ℝ) ≤ F1.card := by exact_mod_cast hc1
  have hc2' : ((F0.filter (fun A => A ∈ Bad)).card : ℝ)
      + (F0.filter (fun A => A ∉ Bad)).card = F0.card := by exact_mod_cast hc2
  have hc3' : (F1.card : ℝ) + F0.card = F.card := by exact_mod_cast hc3
  rw [← hsplit, hsum1]
  linarith


lemma main_empty (F : Finset (Finset α)) (h0 : ∅ ∈ F) (hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F) :
    (F.card : ℝ) * Real.log F.card ≤ 2 * Real.log 2 * ∑ A ∈ F, (A.card : ℝ) := by
  set U := F.sup id with hUdef
  set n := U.card with hn
  set N := F.card with hN
  set L := Real.log 2 with hL
  have hLpos : 0 < L := Real.log_pos (by norm_num)
  have hNpos : (0 : ℝ) < N := by exact_mod_cast Finset.card_pos.mpr ⟨∅, h0⟩
  have hfpos : ∀ A ∈ F, (0 : ℝ) < (fib F A).card := fun A hA => by
    exact_mod_cast fib_card_pos F hA
  -- partition of the powerset
  have hpart : ∑ A ∈ F, ((fib F A).card : ℝ) = 2 ^ n := by
    have := Finset.card_eq_sum_card_fiberwise (f := mx F) (s := U.powerset) (t := F)
      (fun S _ => mx_mem F h0 hU S)
    rw [Finset.card_powerset] at this
    exact_mod_cast this.symm
  -- double counting
  have hdc : ∀ A ∈ F, ∑ S ∈ fib F A, (S.card : ℝ)
      = ∑ x ∈ U, (((fib F A).filter (fun S => x ∈ S)).card : ℝ) := by
    intro A _
    have h : ∀ S ∈ fib F A, (S.card : ℝ) = ∑ x ∈ U, (if x ∈ S then (1 : ℝ) else 0) := by
      intro S hS
      rw [Finset.sum_boole, Finset.filter_mem_eq_inter,
        Finset.inter_eq_right.mpr ((mem_fib F A S).mp hS).1]
    rw [Finset.sum_congr rfl h, Finset.sum_comm]
    apply Finset.sum_congr rfl
    intro x _
    rw [Finset.sum_boole]
  have hF4 : (N : ℝ) * n / 2 ≤
      ∑ A ∈ F, (∑ S ∈ fib F A, (S.card : ℝ)) / (fib F A).card := by
    rw [Finset.sum_congr rfl (fun A hA => by rw [hdc A hA])]
    simp_rw [Finset.sum_div]
    rw [Finset.sum_comm]
    calc (N : ℝ) * n / 2 = ∑ x ∈ U, (N : ℝ) / 2 := by
          rw [Finset.sum_const, nsmul_eq_mul]; ring
      _ ≤ _ := Finset.sum_le_sum (fun x hx => marginal F h0 hU hx)
  -- per fibre
  have h1 : ∀ A ∈ F, 2 * L * ((∑ S ∈ fib F A, (S.card : ℝ)) / (fib F A).card)
      ≤ 2 * L * A.card + Real.log (fib F A).card := by
    intro A hA
    have hb := fib_bound F h0 hU hA
    have hp := hfpos A hA
    rw [← mul_div_assoc, div_le_iff₀ hp]
    exact hb.trans (le_of_eq (by ring))
  -- AM-GM
  have hF5 : ∑ A ∈ F, Real.log (fib F A).card ≤ N * (n * L) - N * Real.log N := by
    have h2n : (0 : ℝ) < 2 ^ n := by positivity
    have hlog : ∀ A ∈ F, Real.log (fib F A).card
        ≤ (fib F A).card * N / 2 ^ n - 1 - Real.log N + n * L := by
      intro A hA
      have hp := hfpos A hA
      have := Real.log_le_sub_one_of_pos
        (show 0 < ((fib F A).card : ℝ) * N / 2 ^ n by positivity)
      rw [Real.log_div (by positivity) h2n.ne', Real.log_mul hp.ne' hNpos.ne',
        Real.log_pow] at this
      linarith
    have hs := Finset.sum_le_sum hlog
    have e1 : ∑ A ∈ F, (((fib F A).card : ℝ) * N / 2 ^ n - 1 - Real.log N + n * L)
        = (∑ A ∈ F, ((fib F A).card : ℝ)) * N / 2 ^ n - N - N * Real.log N + N * (n * L) := by
      rw [Finset.sum_add_distrib, Finset.sum_sub_distrib, Finset.sum_sub_distrib,
        ← Finset.sum_div, ← Finset.sum_mul]
      simp only [Finset.sum_const, nsmul_eq_mul, mul_one]
      rfl
    rw [e1, hpart] at hs
    have e2 : (2 : ℝ) ^ n * N / 2 ^ n = N := by field_simp
    rw [e2] at hs
    linarith
  have h2 := Finset.sum_le_sum h1
  rw [← Finset.mul_sum, Finset.sum_add_distrib, ← Finset.mul_sum] at h2
  have h3 : 2 * L * ((N : ℝ) * n / 2) ≤
      2 * L * ∑ A ∈ F, (∑ S ∈ fib F A, (S.card : ℝ)) / (fib F A).card :=
    mul_le_mul_of_nonneg_left hF4 (by positivity)
  nlinarith

end P3

open P3 in
theorem problem3 {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  set F := insert ∅ A with hF
  have h0 : ∅ ∈ F := Finset.mem_insert_self _ _
  have hU : ∀ a ∈ F, ∀ b ∈ F, a ∪ b ∈ F := by
    intro a ha b hb
    rw [Finset.mem_insert] at ha hb
    rcases ha with rfl | ha <;> rcases hb with rfl | hb
    · rw [Finset.empty_union]; exact h0
    · rw [Finset.empty_union]; exact Finset.mem_insert_of_mem hb
    · rw [Finset.union_empty]; exact Finset.mem_insert_of_mem ha
    · exact Finset.mem_insert_of_mem (hunion a ha b hb)
  have hsum : ∑ a ∈ F, a.card = ∑ a ∈ A, a.card := by
    by_cases h : ∅ ∈ A
    · rw [hF, Finset.insert_eq_of_mem h]
    · rw [hF, Finset.sum_insert h, Finset.card_empty, zero_add]
  have hmain := main_empty F h0 hU
  have hcard : A.card ≤ F.card := Finset.card_le_card (Finset.subset_insert _ _)
  have hpos : 0 < F.card := Finset.card_pos.mpr ⟨∅, h0⟩
  have h1 : ((F.card : ℝ)) ^ F.card ≤ (2 : ℝ) ^ (2 * ∑ a ∈ A, a.card) := by
    rw [← Real.log_le_log_iff (by positivity) (by positivity), Real.log_pow, Real.log_pow]
    have hs : (∑ a ∈ F, (a.card : ℝ)) = ((∑ a ∈ A, a.card : ℕ) : ℝ) := by
      rw [← hsum]; push_cast; rfl
    rw [hs] at hmain
    push_cast at hmain ⊢
    have e : (2 * ∑ x ∈ A, (x.card : ℝ)) * Real.log 2
        = 2 * Real.log 2 * ∑ x ∈ A, (x.card : ℝ) := by ring
    rw [e]
    exact hmain
  have h2 : A.card ^ A.card ≤ F.card ^ F.card :=
    calc A.card ^ A.card ≤ F.card ^ A.card := Nat.pow_le_pow_left hcard _
      _ ≤ F.card ^ F.card := Nat.pow_le_pow_right hpos hcard
  have h3 : F.card ^ F.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by exact_mod_cast h1
  exact h2.trans h3
