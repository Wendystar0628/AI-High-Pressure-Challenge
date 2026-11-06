import Mathlib.Combinatorics.SetFamily.HarrisKleitman
import Mathlib.Analysis.SpecialFunctions.Log.NegMulLog
import Mathlib.Analysis.MeanInequalities
import Mathlib.Data.Finset.Max
import Mathlib.Data.Finset.Interval
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Positivity

open Finset

private def rise {α : Type*} [DecidableEq α]
    (B : Finset (Finset α)) (x : α) (s : Finset α) : Finset α :=
  if insert x s ∈ B then s else insert x s

private lemma subset_rise {α : Type*} [DecidableEq α]
    (B : Finset (Finset α)) (x : α) (s : Finset α) : s ⊆ rise B x s := by
  unfold rise
  split_ifs
  · exact Subset.rfl
  · exact subset_insert _ _

private lemma insert_mem_rise_image {α : Type*} [DecidableEq α]
    (B : Finset (Finset α)) (x : α) {s : Finset α} (hs : s ∈ B) :
    insert x s ∈ B.image (rise B x) := by
  by_cases h : insert x s ∈ B
  · exact mem_image.mpr ⟨insert x s, h, by simp [rise, h]⟩
  · exact mem_image.mpr ⟨s, hs, by simp [rise, h]⟩

private def RisingGood {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (g : Finset α → Finset α) : Prop :=
  (∀ a ∈ A, a ⊆ g a) ∧
  (∀ a ∈ A, ∀ b ∈ A, b ⊆ g a → b ⊆ a) ∧
  (∀ s ∈ A.image g, ∀ a ∈ A, s ∪ a ∈ A.image g)

private lemma risingGood_inj {α : Type*} [DecidableEq α]
    {A : Finset (Finset α)} {g : Finset α → Finset α} (hg : RisingGood A g) :
    Set.InjOn g A := by
  intro a ha b hb he
  exact Subset.antisymm (hg.2.1 b hb a ha (he ▸ hg.1 a ha))
    (hg.2.1 a ha b hb (he.symm ▸ hg.1 b hb))

private lemma risingGood_rise {α : Type*} [DecidableEq α]
    {A : Finset (Finset α)} {g : Finset α → Finset α} (hg : RisingGood A g) (x : α) :
    RisingGood A (fun a => rise (A.image g) x (g a)) := by
  classical
  let B := A.image g
  have hi : A.image (fun a => rise B x (g a)) = B.image (rise B x) := by
    simp only [B, image_image, Function.comp_def]
  refine ⟨fun a ha => (hg.1 a ha).trans (subset_rise B x (g a)), ?_, ?_⟩
  · intro a ha b hb hba
    change b ⊆ rise B x (g a) at hba
    apply hg.2.1 a ha b hb
    by_cases h : insert x (g a) ∈ B
    · simpa only [rise, if_pos h] using hba
    · have hbsub : b ⊆ insert x (g a) := by simpa only [rise, if_neg h] using hba
      intro y hy
      rcases mem_insert.mp (hbsub hy) with hxy | hya
      · subst y
        have he : g a ∪ b = insert x (g a) := by
          apply Subset.antisymm
          · exact union_subset (subset_insert _ _) hbsub
          · exact insert_subset (mem_union_right _ hy) subset_union_left
        exact False.elim (h (he ▸ hg.2.2 (g a) (mem_image_of_mem g ha) b hb))
      · exact hya
  · rw [hi]
    intro s hs a ha
    obtain ⟨t, ht, rfl⟩ := mem_image.mp hs
    have hc : t ∪ a ∈ B := hg.2.2 t ht a ha
    by_cases h : insert x t ∈ B
    · have hca : insert x (t ∪ a) ∈ B := by
        simpa only [insert_union] using hg.2.2 (insert x t) h a ha
      exact mem_image.mpr ⟨t ∪ a, hc, by simp [rise, h, hca]⟩
    · simpa only [rise, if_neg h, insert_union] using insert_mem_rise_image B x hc

private lemma exists_rising {α : Type*} [DecidableEq α] [Fintype α]
    (A : Finset (Finset α))
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    ∃ g : Finset α → Finset α, RisingGood A g ∧ IsUpperSet (A.image g : Set (Finset α)) := by
  classical
  let C := (Finset.univ : Finset (Finset α → Finset α)).filter (RisingGood A)
  have hid : RisingGood A id := by
    refine ⟨fun _ _ => Subset.rfl, fun _ _ _ _ h => h, ?_⟩
    simpa using hunion
  obtain ⟨g, hgC, hmax⟩ := C.exists_max_image (fun g => ∑ a ∈ A, (g a).card)
    ⟨id, by simp [C, hid]⟩
  have hg := (mem_filter.mp hgC).2
  refine ⟨g, hg, ?_⟩
  have hins : ∀ s ∈ A.image g, ∀ x, insert x s ∈ A.image g := by
    intro s hs x
    by_contra hno
    obtain ⟨a, ha, rfl⟩ := mem_image.mp hs
    have hxa : x ∉ g a := by
      intro h
      exact hno (by simpa [insert_eq_of_mem h] using mem_image_of_mem g ha)
    have hle := hmax (fun b => rise (A.image g) x (g b))
      (by simp only [C, mem_filter, mem_univ, true_and]; exact risingGood_rise hg x)
    have hlt : (∑ b ∈ A, (g b).card) < ∑ b ∈ A, (rise (A.image g) x (g b)).card := by
      apply sum_lt_sum (fun b _ => card_le_card (subset_rise _ _ _))
      exact ⟨a, ha, by simp [rise, hno, card_insert_of_notMem hxa]⟩
    exact (not_lt_of_ge hle) hlt
  intro s t hst hs
  have hall : ∀ u : Finset α, s ∪ u ∈ A.image g := by
    intro u
    induction u using Finset.induction with
    | empty => simpa using hs
    | insert x u _ ih => simpa only [union_insert] using hins (s ∪ u) ih x
  simpa [union_eq_right.mpr hst] using hall t

private lemma log_merge (a b : ℝ) (hb : 0 ≤ b) (hba : b ≤ a) :
    a * Real.log a + b * Real.log b + 2 * b * Real.log 2 ≤
      (a + b) * Real.log (a + b) := by
  have ha : 0 ≤ a := hb.trans hba
  by_cases hzero : a + b = 0
  · have : a = 0 ∧ b = 0 := by constructor <;> linarith
    simp [this.1, this.2]
  have hp : 0 < a + b := lt_of_le_of_ne (add_nonneg ha hb) (Ne.symm hzero)
  have hu : 0 ≤ 1 - 2 * b / (a + b) := by
    apply sub_nonneg.mpr
    apply (div_le_one hp).mpr
    linarith
  have hv : 0 ≤ 2 * b / (a + b) := by positivity
  have hsum : (1 - 2 * b / (a + b)) + 2 * b / (a + b) = 1 := by ring
  have h1 := Real.convexOn_mul_log.2 (show a + b ∈ Set.Ici (0 : ℝ) by simpa using hp.le)
    (show (a + b) / 2 ∈ Set.Ici (0 : ℝ) by simp only [Set.mem_Ici]; positivity) hu hv hsum
  have h2 := Real.convexOn_mul_log.2 (show (0 : ℝ) ∈ Set.Ici 0 by simp)
    (show (a + b) / 2 ∈ Set.Ici (0 : ℝ) by simp only [Set.mem_Ici]; positivity) hu hv hsum
  simp only [smul_eq_mul] at h1 h2
  have he1 : (1 - 2 * b / (a + b)) * (a + b) + 2 * b / (a + b) * ((a + b) / 2) = a := by
    field_simp
    ring
  have he2 : (1 - 2 * b / (a + b)) * 0 + 2 * b / (a + b) * ((a + b) / 2) = b := by
    field_simp
    ring
  rw [he1] at h1
  rw [he2] at h2
  rw [Real.log_div hzero (by norm_num)] at h1 h2
  have he3 : (1 - 2 * b / (a + b)) * ((a + b) * Real.log (a + b)) +
      2 * (2 * b / (a + b) * ((a + b) / 2 * (Real.log (a + b) - Real.log 2))) =
      (a + b) * Real.log (a + b) - 2 * b * Real.log 2 := by
    field_simp
    ring
  nlinarith

private lemma sum_card_families {α : Type*} [DecidableEq α]
    (D : Finset (Finset α)) (x : α) :
    (∑ s ∈ D, s.card) = (∑ s ∈ D.nonMemberSubfamily x, s.card) +
      (∑ s ∈ D.memberSubfamily x, s.card) + (D.memberSubfamily x).card := by
  have hi : Set.InjOn (insert x) (D.memberSubfamily x : Set (Finset α)) := by
    intro s hs t ht he
    have hsx := (mem_memberSubfamily.mp hs).2
    have htx := (mem_memberSubfamily.mp ht).2
    simpa [hsx, htx] using congrArg (fun s : Finset α => s.erase x) he
  have he : (∑ s ∈ D.memberSubfamily x, s.card) + (D.memberSubfamily x).card =
      ∑ s ∈ D.filter (x ∈ ·), s.card := by
    rw [← image_insert_memberSubfamily, sum_image hi]
    calc
      _ = ∑ s ∈ D.memberSubfamily x, (s.card + 1) := by simp [sum_add_distrib]
      _ = _ := sum_congr rfl (fun s hs =>
        (card_insert_of_notMem (mem_memberSubfamily.mp hs).2).symm)
  have hp := sum_filter_add_sum_filter_not D (fun s => x ∈ s) Finset.card
  change _ + (∑ s ∈ D.nonMemberSubfamily x, s.card) = _ at hp
  omega

private lemma downset_log_bound {α : Type*} [DecidableEq α]
    (D : Finset (Finset α)) (hD : IsLowerSet (D : Set (Finset α))) :
    2 * (∑ s ∈ D, (s.card : ℝ)) * Real.log 2 ≤ (D.card : ℝ) * Real.log D.card := by
  induction D using Finset.memberFamily_induction_on with
  | empty => simp
  | singleton_empty => simp
  | @subfamily x D ih0 ih1 =>
    have h0 := ih0 hD.nonMemberSubfamily
    have h1 := ih1 hD.memberSubfamily
    have hc := card_memberSubfamily_add_card_nonMemberSubfamily x D
    have hle := card_le_card (hD.memberSubfamily_subset_nonMemberSubfamily (a := x))
    have hm := log_merge ((D.nonMemberSubfamily x).card : ℝ)
      ((D.memberSubfamily x).card : ℝ) (by positivity) (by exact_mod_cast hle)
    have hs := sum_card_families D x
    have hsr : (∑ s ∈ D, (s.card : ℝ)) =
        (∑ s ∈ D.nonMemberSubfamily x, (s.card : ℝ)) +
        (∑ s ∈ D.memberSubfamily x, (s.card : ℝ)) + (D.memberSubfamily x).card := by
      exact_mod_cast hs
    have hcr : ((D.nonMemberSubfamily x).card : ℝ) + (D.memberSubfamily x).card = D.card := by
      exact_mod_cast ((Nat.add_comm _ _).trans hc)
    rw [hcr] at hm
    rw [hsr]
    nlinarith

private lemma rising_interval_bound {α : Type*} [DecidableEq α] [Fintype α]
    (A : Finset (Finset α)) {g : Finset α → Finset α} (hg : RisingGood A g)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    (∑ a ∈ A, 2 ^ ((g a).card - a.card)) ≤ 2 ^ Fintype.card α := by
  classical
  have hd : (A : Set (Finset α)).Pairwise (fun a b => Disjoint (Icc a (g a)) (Icc b (g b))) := by
    intro a ha b hb hab
    apply Finset.disjoint_left.mpr
    intro t hta htb
    obtain ⟨hat, htga⟩ := mem_Icc.mp hta
    obtain ⟨hbt, htgb⟩ := mem_Icc.mp htb
    have hu := hunion a ha b hb
    have hsub : a ∪ b ⊆ t := union_subset hat hbt
    have h1 := hg.2.1 a ha (a ∪ b) hu (hsub.trans htga)
    have h2 := hg.2.1 b hb (a ∪ b) hu (hsub.trans htgb)
    exact hab (Subset.antisymm (subset_union_left.trans h2) (subset_union_right.trans h1))
  calc
    _ = (A.biUnion (fun a => Icc a (g a))).card := by
      rw [card_biUnion hd]
      exact sum_congr rfl (fun a ha => (card_Icc_finset (hg.1 a ha)).symm)
    _ ≤ Fintype.card (Finset α) := card_le_univ _
    _ = _ := Fintype.card_finset

private lemma power_sum_log_bound {ι : Type*} (A : Finset ι) (hA : A.Nonempty)
    (d : ι → ℕ) (N : ℕ) (hs : (∑ a ∈ A, 2 ^ d a) ≤ 2 ^ N) :
    (∑ a ∈ A, (d a : ℝ)) * Real.log 2 ≤
      (A.card : ℝ) * ((N : ℝ) * Real.log 2 - Real.log A.card) := by
  have hm : (0 : ℝ) < A.card := by exact_mod_cast hA.card_pos
  have hq : (0 : ℝ) < 2 ^ N := by positivity
  have hh := sum_le_sum (s := A) (fun a _ =>
    Real.log_le_sub_one_of_pos (show (0 : ℝ) < (2 : ℝ) ^ d a * A.card / 2 ^ N by positivity))
  have hlog (a : ι) : Real.log ((2 : ℝ) ^ d a * A.card / 2 ^ N) =
      (d a : ℝ) * Real.log 2 + Real.log A.card - (N : ℝ) * Real.log 2 := by
    rw [Real.log_div (by positivity) hq.ne', Real.log_mul (by positivity) hm.ne',
      Real.log_pow, Real.log_pow]
  have he : (∑ a ∈ A, Real.log ((2 : ℝ) ^ d a * A.card / 2 ^ N)) =
      (∑ a ∈ A, (d a : ℝ)) * Real.log 2 +
      (A.card : ℝ) * Real.log A.card - A.card * (N : ℝ) * Real.log 2 := by
    simp only [hlog, sum_sub_distrib,
      sum_add_distrib, ← sum_mul, sum_const, nsmul_eq_mul]
  have he2 : (∑ a ∈ A, ((2 : ℝ) ^ d a * A.card / 2 ^ N - 1)) =
      (∑ a ∈ A, (2 : ℝ) ^ d a) * A.card / 2 ^ N - A.card := by
    simp only [sum_sub_distrib, ← sum_div, ← sum_mul, sum_const, nsmul_eq_mul, mul_one]
  have hsr : (∑ a ∈ A, (2 : ℝ) ^ d a) ≤ 2 ^ N := by exact_mod_cast hs
  have hb : (∑ a ∈ A, (2 : ℝ) ^ d a) * A.card / 2 ^ N ≤ (A.card : ℝ) := by
    apply (div_le_iff₀ hq).mpr
    nlinarith
  rw [he, he2] at hh
  nlinarith

private theorem union_closed_log_bound {α : Type*} [DecidableEq α] [Fintype α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    (A.card : ℝ) * Real.log A.card ≤ 2 * (∑ a ∈ A, (a.card : ℝ)) * Real.log 2 := by
  classical
  obtain ⟨g, hg, hup⟩ := exists_rising A hunion
  let B := A.image g
  let D := B.image (fun b => bᶜ)
  have hcompl : Function.Injective (fun b : Finset α => bᶜ) := compl_injective
  have hginj := risingGood_inj hg
  have hDc : D.card = A.card := by
    dsimp only [D, B]
    rw [card_image_of_injective _ hcompl, card_image_of_injOn hginj]
  have hD : IsLowerSet (D : Set (Finset α)) := by
    intro t s hst ht
    obtain ⟨b, hb, he⟩ := mem_image.mp ht
    refine mem_image.mpr ⟨sᶜ, ?_, compl_compl s⟩
    apply hup (show b ⊆ sᶜ from ?_) hb
    rw [← compl_compl b]
    exact compl_subset_compl.mpr (he.symm ▸ hst)
  have hds : (∑ s ∈ D, (s.card : ℝ)) =
      (A.card : ℝ) * Fintype.card α - ∑ a ∈ A, ((g a).card : ℝ) := by
    dsimp only [D, B]
    rw [sum_image (fun _ _ _ _ h => hcompl h), sum_image hginj]
    simp_rw [card_compl, Nat.cast_sub (card_le_univ _)]
    simp [sum_sub_distrib]
  have hdiff : (∑ a ∈ A, (((g a).card - a.card : ℕ) : ℝ)) =
      (∑ a ∈ A, ((g a).card : ℝ)) - ∑ a ∈ A, (a.card : ℝ) := by
    rw [← sum_sub_distrib]
    exact sum_congr rfl (fun a ha => Nat.cast_sub (card_le_card (hg.1 a ha)))
  have hd := downset_log_bound D hD
  have hi := power_sum_log_bound A hA (fun a => (g a).card - a.card)
    (Fintype.card α) (rising_interval_bound A hg hunion)
  rw [hDc, hds] at hd
  rw [hdiff] at hi
  nlinarith

theorem problem3 {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  classical
  let U := A.biUnion id
  let restrict : Finset α → Finset U := fun s => s.subtype (· ∈ U)
  have hsub (s : Finset α) (hs : s ∈ A) : s ⊆ U := subset_biUnion_of_mem id hs
  have hmap (s : Finset α) (hs : s ∈ A) :
      (restrict s).map (Function.Embedding.subtype (· ∈ U)) = s :=
    subtype_map_of_mem (hsub s hs)
  have hinj : Set.InjOn restrict A := by
    intro s hs t ht he
    simpa only [hmap s hs, hmap t ht] using
      congrArg (fun s => s.map (Function.Embedding.subtype (· ∈ U))) he
  have hcard (s : Finset α) (hs : s ∈ A) : (restrict s).card = s.card := by
    simpa only [card_map] using congrArg Finset.card (hmap s hs)
  have hun : ∀ s ∈ A.image restrict, ∀ t ∈ A.image restrict, s ∪ t ∈ A.image restrict := by
    intro s hs t ht
    obtain ⟨a, ha, rfl⟩ := mem_image.mp hs
    obtain ⟨b, hb, rfl⟩ := mem_image.mp ht
    refine mem_image.mpr ⟨a ∪ b, hunion a ha b hb, ?_⟩
    ext x
    simp [restrict]
  have hh := union_closed_log_bound (A.image restrict) (hA.image restrict) hun
  rw [card_image_of_injOn hinj, sum_image hinj] at hh
  have hsum : (∑ a ∈ A, ((restrict a).card : ℝ)) = ∑ a ∈ A, (a.card : ℝ) :=
    sum_congr rfl (fun a ha => by rw [hcard a ha])
  rw [hsum] at hh
  have hp : (0 : ℝ) < A.card := by exact_mod_cast hA.card_pos
  have hlog : Real.log ((A.card : ℝ) ^ A.card) ≤
      Real.log ((2 : ℝ) ^ (2 * ∑ a ∈ A, a.card)) := by
    simpa only [Real.log_pow, Nat.cast_mul, Nat.cast_ofNat, Nat.cast_sum] using hh
  exact_mod_cast (Real.log_le_log_iff (pow_pos hp _) (by positivity)).mp hlog
