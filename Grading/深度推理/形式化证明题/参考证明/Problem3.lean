import Mathlib.Combinatorics.Colex
import Mathlib.Combinatorics.SetFamily.HarrisKleitman
import Mathlib.Data.Finset.Interval
import Mathlib.Analysis.SpecialFunctions.BinaryEntropy
import Mathlib.Algebra.BigOperators.Field
import Mathlib.Tactic.Choose
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.Ring

open Finset

namespace Reimer

variable {α : Type*} [DecidableEq α]

/-- The members of `A` contained in `s` have largest member `a`. -/
def Good (A : Finset (Finset α)) (a s : Finset α) : Prop :=
  a ⊆ s ∧ ∀ b ∈ A, b ⊆ s → b ⊆ a

omit [DecidableEq α] in
lemma good_self (A : Finset (Finset α)) (a : Finset α) : Good A a a :=
  ⟨Subset.rfl, fun _ _ h => h⟩

lemma exists_good_root (A : Finset (Finset α))
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A)
    {a t : Finset α} (ha : a ∈ A) (hat : a ⊆ t) :
    ∃ c ∈ A, Good A c t ∧ a ⊆ c := by
  let S := A.filter (fun b => b ⊆ t)
  have hS : S.Nonempty := ⟨a, mem_filter.mpr ⟨ha, hat⟩⟩
  let c := S.sup' hS id
  have hc : c ∈ A :=
    Finset.sup'_mem (A : Set (Finset α)) hunion S hS id
      (fun b hb => (mem_filter.mp hb).1)
  refine ⟨c, hc, ⟨?_, ?_⟩, ?_⟩
  · exact Finset.sup'_le hS id (fun b hb => (mem_filter.mp hb).2)
  · intro b hb hbt
    exact Finset.le_sup' id (mem_filter.mpr ⟨hb, hbt⟩ : b ∈ S)
  · exact Finset.le_sup' id (mem_filter.mpr ⟨ha, hat⟩ : a ∈ S)

/-- Colex-maximal representatives of the fibers form an upper family. -/
lemma exists_representatives [LinearOrder α]
    (A : Finset (Finset α)) (u : Finset α)
    (hAu : ∀ a ∈ A, a ⊆ u)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    ∃ f : Finset α → Finset α,
      (∀ a ∈ A, Good A a (f a) ∧ f a ⊆ u) ∧
      (∀ a ∈ A, ∀ x ∈ u, insert x (f a) ∈ A.image f) := by
  classical
  have hex : ∀ a : Finset α, ∃ s : Finset α, a ∈ A →
      Good A a s ∧ s ⊆ u ∧
        ∀ t : Finset α, Good A a t → t ⊆ u →
          toColex t ≤ toColex s := by
    intro a
    by_cases ha : a ∈ A
    · let S := u.powerset.filter (Good A a)
      have hS : S.Nonempty :=
        ⟨a, mem_filter.mpr ⟨mem_powerset.mpr (hAu a ha), good_self A a⟩⟩
      obtain ⟨s, hs, hmax⟩ := S.exists_max_image toColex hS
      have hs' := mem_filter.mp hs
      refine ⟨s, fun _ => ⟨hs'.2, mem_powerset.mp hs'.1, ?_⟩⟩
      intro t ht htu
      exact hmax t (mem_filter.mpr ⟨mem_powerset.mpr htu, ht⟩)
    · exact ⟨∅, fun h => (ha h).elim⟩
  choose f hf using hex
  refine ⟨f, (fun a ha => ⟨(hf a ha).1, (hf a ha).2.1⟩), ?_⟩
  intro a ha x hxu
  by_cases hxa : x ∈ f a
  · simpa [insert_eq_of_mem hxa] using mem_image_of_mem f ha
  have hfa := hf a ha
  have htu : insert x (f a) ⊆ u := insert_subset hxu hfa.2.1
  obtain ⟨c, hc, hct, hac⟩ :=
    exists_good_root A hunion ha (hfa.1.1.trans (subset_insert x (f a)))
  have hxc : x ∈ c := by
    by_contra hn
    have hcf : c ⊆ f a := (subset_insert_iff_of_notMem hn).mp hct.1
    have hca : c = a := (hfa.1.2 c hc hcf).antisymm hac
    subst c
    have hh := hfa.2.2 (insert x (f a)) hct htu
    have hl : toColex (f a) < toColex (insert x (f a)) :=
      Finset.Colex.toColex_lt_toColex_of_ssubset (ssubset_insert hxa)
    exact (not_le_of_gt hl) hh
  have hfc := hf c hc
  have hx_fc : x ∈ f c := hfc.1.1 hxc
  have haerase : a ⊆ (f c).erase x := by
    intro y hy
    exact mem_erase.mpr ⟨fun h => hxa (h ▸ hfa.1.1 hy), hfc.1.1 (hac hy)⟩
  have herase : Good A a ((f c).erase x) := by
    refine ⟨haerase, ?_⟩
    intro b hb hbe
    have hbc : b ⊆ c := hfc.1.2 b hb (hbe.trans (erase_subset _ _))
    have hbf : b ⊆ f a := by
      intro y hy
      have hyt := hct.1 (hbc hy)
      rcases mem_insert.mp hyt with h | h
      · exact False.elim ((mem_erase.mp (hbe hy)).1 h)
      · exact h
    exact hfa.1.2 b hb hbf
  have herase_le := hfa.2.2 ((f c).erase x) herase
    ((erase_subset _ _).trans hfc.2.1)
  have hle : toColex (f c) ≤ toColex (insert x (f a)) := by
    apply (Finset.Colex.toColex_sdiff_le_toColex_sdiff
      (singleton_subset_iff.mpr hx_fc)
      (singleton_subset_iff.mpr (mem_insert_self x (f a)))).mp
    simpa [sdiff_singleton_eq_erase, erase_insert hxa] using herase_le
  have hge := hfc.2.2 (insert x (f a)) hct htu
  have heq : f c = insert x (f a) := toColex.injective (hle.antisymm hge)
  exact mem_image.mpr ⟨c, hc, heq⟩

lemma entropy_chord {p : ℝ} (hp : 0 ≤ p) (hp' : p ≤ 1 / 2) :
    2 * p * Real.log 2 ≤ Real.binEntropy p := by
  obtain ⟨_, hconc⟩ := Real.strictConcave_binEntropy.concaveOn
  have h := hconc
    (x := 0) (y := (2 : ℝ)⁻¹) (by norm_num) (by norm_num)
    (a := 1 - 2 * p) (b := 2 * p) (by linarith) (by positivity) (by ring)
  have heq : 2 * p * (2 : ℝ)⁻¹ = p := by ring
  simpa only [smul_eq_mul, Real.binEntropy_zero, Real.binEntropy_two_inv,
    mul_zero, zero_add, heq] using h

lemma entropy_split {x y : ℝ} (_hx : 0 ≤ x) (hy : 0 ≤ y) (hyx : y ≤ x) :
    x * Real.log x + y * Real.log y + 2 * y * Real.log 2 ≤
      (x + y) * Real.log (x + y) := by
  by_cases hy0 : y = 0
  · simp [hy0]
  have hypos : 0 < y := lt_of_le_of_ne hy (Ne.symm hy0)
  have hxpos : 0 < x := hypos.trans_le hyx
  have hmpos : 0 < x + y := add_pos hxpos hypos
  have hp0 : 0 ≤ y / (x + y) := div_nonneg hy hmpos.le
  have hp1 : y / (x + y) ≤ 1 / 2 := by
    apply (div_le_iff₀ hmpos).mpr
    linarith
  have h := mul_le_mul_of_nonneg_left (entropy_chord hp0 hp1) hmpos.le
  have hq : 1 - y / (x + y) = x / (x + y) := by
    field_simp
    ring
  have hid : (x + y) * Real.binEntropy (y / (x + y)) =
      (x + y) * Real.log (x + y) - x * Real.log x - y * Real.log y := by
    rw [Real.binEntropy, hq, Real.log_inv, Real.log_inv,
      Real.log_div hypos.ne' hmpos.ne', Real.log_div hxpos.ne' hmpos.ne']
    field_simp
    ring
  have hl : (x + y) * (2 * (y / (x + y)) * Real.log 2) =
      2 * y * Real.log 2 := by
    field_simp
  rw [hid, hl] at h
  linarith

lemma sum_split (D : Finset (Finset α)) (x : α) (w : Finset α → ℝ) :
    ∑ s ∈ D, w s =
      (∑ s ∈ D.nonMemberSubfamily x, w s) +
      ∑ s ∈ D.memberSubfamily x, w (insert x s) := by
  classical
  have hinj : Set.InjOn (insert x) (D.memberSubfamily x : Set (Finset α)) := by
    intro s hs t ht hst
    have hsx := (mem_memberSubfamily.mp hs).2
    have htx := (mem_memberSubfamily.mp ht).2
    simpa [erase_insert hsx, erase_insert htx] using
      congrArg (fun r : Finset α => r.erase x) hst
  rw [← sum_image hinj, image_insert_memberSubfamily]
  simpa only [nonMemberSubfamily, add_comm] using
    (sum_filter_add_sum_filter_not D (fun s => x ∈ s) w).symm

/-- The edge bound for a lower family in a Boolean cube. -/
lemma lower_sum_card (D : Finset (Finset α))
    (hD : IsLowerSet (D : Set (Finset α))) :
    2 * (∑ s ∈ D, (s.card : ℝ)) * Real.log 2 ≤
      (D.card : ℝ) * Real.log D.card := by
  induction D using Finset.memberFamily_induction_on with
  | empty => simp
  | singleton_empty => simp
  | @subfamily x D ih0 ih1 =>
    have h0 := ih0 hD.nonMemberSubfamily
    have h1 := ih1 hD.memberSubfamily
    have hcard := card_memberSubfamily_add_card_nonMemberSubfamily x D
    have hcardR : (D.nonMemberSubfamily x).card +
        ((D.memberSubfamily x).card : ℝ) = D.card := by
      exact_mod_cast (by simpa [add_comm] using hcard)
    have hsum : (∑ s ∈ D, (s.card : ℝ)) =
        (∑ s ∈ D.nonMemberSubfamily x, (s.card : ℝ)) +
        (∑ s ∈ D.memberSubfamily x, (s.card : ℝ)) +
        (D.memberSubfamily x).card := by
      rw [sum_split D x]
      have heq : (∑ s ∈ D.memberSubfamily x, ((insert x s).card : ℝ)) =
          (∑ s ∈ D.memberSubfamily x, (s.card : ℝ)) +
          (D.memberSubfamily x).card := by
        calc
          _ = ∑ s ∈ D.memberSubfamily x, ((s.card : ℝ) + 1) := by
            apply sum_congr rfl
            intro s hs
            rw [card_insert_of_notMem (mem_memberSubfamily.mp hs).2, Nat.cast_add,
              Nat.cast_one]
          _ = _ := by simp [sum_add_distrib]
      rw [heq]
      ring
    have hle : ((D.memberSubfamily x).card : ℝ) ≤ (D.nonMemberSubfamily x).card := by
      exact_mod_cast card_le_card hD.memberSubfamily_subset_nonMemberSubfamily
    have hn := entropy_split (x := ((D.nonMemberSubfamily x).card : ℝ))
      (y := ((D.memberSubfamily x).card : ℝ)) (by positivity) (by positivity) hle
    rw [hcardR] at hn
    rw [hsum]
    nlinarith

omit [DecidableEq α] in
lemma good_inj {A : Finset (Finset α)} {f : Finset α → Finset α}
    (hf : ∀ a ∈ A, Good A a (f a)) : Set.InjOn f (A : Set (Finset α)) := by
  intro a ha b hb hab
  have ha' := hf a ha
  have hb' := hf b hb
  exact (hb'.2 a ha (hab ▸ ha'.1)).antisymm (ha'.2 b hb (hab.symm ▸ hb'.1))

/-- The intervals from members to their representatives are pairwise disjoint. -/
lemma interval_count {A : Finset (Finset α)} {u : Finset α}
    {f : Finset α → Finset α}
    (hf : ∀ a ∈ A, Good A a (f a) ∧ f a ⊆ u) :
    ∑ a ∈ A, 2 ^ ((f a).card - a.card) ≤ 2 ^ u.card := by
  classical
  have hd : (A : Set (Finset α)).PairwiseDisjoint (fun a => Icc a (f a)) := by
    intro a ha b hb hab
    apply disjoint_left.mpr
    intro t hta htb
    obtain ⟨hat, htf⟩ := mem_Icc.mp hta
    obtain ⟨hbt, htfb⟩ := mem_Icc.mp htb
    exact hab (((hf b hb).1.2 a ha (hat.trans htfb)).antisymm
      ((hf a ha).1.2 b hb (hbt.trans htf)))
  have hs : (A.biUnion (fun a => Icc a (f a))) ⊆ u.powerset := by
    intro t ht
    obtain ⟨a, ha, hat⟩ := mem_biUnion.mp ht
    exact mem_powerset.mpr ((mem_Icc.mp hat).2.trans (hf a ha).2)
  have h := card_le_card hs
  rw [card_biUnion hd, card_powerset] at h
  convert h using 1
  apply sum_congr rfl
  intro a ha
  exact (card_Icc_finset (hf a ha).1.1).symm

lemma upper_of_insert {U : Finset (Finset α)} {u s t : Finset α}
    (hup : ∀ s ∈ U, ∀ x ∈ u, insert x s ∈ U)
    (hs : s ∈ U) (hst : s ⊆ t) (htu : t ⊆ u) : t ∈ U := by
  have hadd : ∀ q : Finset α, q ⊆ u → s ∪ q ∈ U := by
    intro q
    induction q using Finset.induction_on with
    | empty => simpa using hs
    | @insert x q hx ih =>
      intro hq
      have hq' : q ⊆ u := (subset_insert _ _).trans hq
      simpa only [union_insert] using hup (s ∪ q) (ih hq') x (hq (mem_insert_self _ _))
  simpa only [union_sdiff_of_subset hst] using
    hadd (t \ s) (sdiff_subset.trans htu)

lemma upper_missing_bound {U : Finset (Finset α)} {u : Finset α}
    (hUu : ∀ s ∈ U, s ⊆ u)
    (hup : ∀ s ∈ U, ∀ x ∈ u, insert x s ∈ U) :
    2 * (∑ s ∈ U, ((u.card - s.card : ℕ) : ℝ)) * Real.log 2 ≤
      (U.card : ℝ) * Real.log U.card := by
  classical
  let D := U.image (fun s => u \ s)
  have hinj : Set.InjOn (fun s => u \ s) (U : Set (Finset α)) := by
    intro s hs t ht hst
    have h := congrArg (fun r => u \ r) hst
    simpa only [Finset.sdiff_sdiff_eq_self (hUu s hs),
      Finset.sdiff_sdiff_eq_self (hUu t ht)] using h
  have hD : IsLowerSet (D : Set (Finset α)) := by
    intro t s hst ht
    obtain ⟨a, ha, rfl⟩ := mem_image.mp ht
    have hsu : s ⊆ u := hst.trans sdiff_subset
    have has : a ⊆ u \ s := by
      intro x hx
      refine mem_sdiff.mpr ⟨hUu a ha hx, ?_⟩
      intro hxs
      exact (mem_sdiff.mp (hst hxs)).2 hx
    have hu : u \ s ∈ U := upper_of_insert hup ha has sdiff_subset
    exact mem_image.mpr ⟨u \ s, hu, Finset.sdiff_sdiff_eq_self hsu⟩
  have h := lower_sum_card D hD
  have hc : D.card = U.card := card_image_of_injOn hinj
  have hsum : (∑ s ∈ D, (s.card : ℝ)) =
      ∑ s ∈ U, ((u.card - s.card : ℕ) : ℝ) := by
    rw [show D = U.image (fun s => u \ s) from rfl, sum_image hinj]
    apply sum_congr rfl
    intro s hs
    rw [card_sdiff_of_subset (hUu s hs)]
  rwa [hsum, hc] at h

/-- Apply the logarithm inequality to the sizes of disjoint intervals. -/
lemma kraft_log_bound (A : Finset (Finset α)) (hA : A.Nonempty)
    (n : ℕ) (d : Finset α → ℕ)
    (hcount : ∑ a ∈ A, 2 ^ d a ≤ 2 ^ n) :
    (A.card : ℝ) * Real.log A.card + (∑ a ∈ A, (d a : ℝ)) * Real.log 2 ≤
      (A.card : ℝ) * n * Real.log 2 := by
  have hm : (0 : ℝ) < A.card := by exact_mod_cast hA.card_pos
  have hT : (0 : ℝ) < 2 ^ n := by positivity
  let q : Finset α → ℝ := fun a => (A.card : ℝ) * (2 : ℝ) ^ d a / (2 : ℝ) ^ n
  have hq : ∀ a, 0 < q a := fun a => by dsimp [q]; positivity
  have hsumq : ∑ a ∈ A, q a ≤ (A.card : ℝ) := by
    have hc : (∑ a ∈ A, (2 : ℝ) ^ d a) ≤ (2 : ℝ) ^ n := by
      exact_mod_cast hcount
    dsimp [q]
    rw [← sum_div, ← mul_sum]
    apply (div_le_iff₀ hT).mpr
    exact mul_le_mul_of_nonneg_left hc hm.le
  have hlog := sum_le_sum (s := A)
    (fun a _ => Real.log_le_sub_one_of_pos (hq a))
  have hsumlog : (∑ a ∈ A, Real.log (q a)) =
      (A.card : ℝ) * Real.log A.card + (∑ a ∈ A, (d a : ℝ)) * Real.log 2 -
      (A.card : ℝ) * n * Real.log 2 := by
    have hterm (a : Finset α) : Real.log (q a) = Real.log A.card +
        (d a : ℝ) * Real.log 2 - (n : ℝ) * Real.log 2 := by
      dsimp [q]
      rw [Real.log_div (by positivity) (by positivity),
        Real.log_mul hm.ne' (by positivity), Real.log_pow, Real.log_pow]
    simp_rw [hterm]
    simp only [sum_sub_distrib, sum_add_distrib, sum_const, nsmul_eq_mul, ← sum_mul]
    ring
  have hsub : (∑ a ∈ A, (q a - 1)) = (∑ a ∈ A, q a) - A.card := by
    simp [sum_sub_distrib]
  rw [hsumlog, hsub] at hlog
  linarith

lemma main_log (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    (A.card : ℝ) * Real.log A.card ≤
      2 * (∑ a ∈ A, (a.card : ℝ)) * Real.log 2 := by
  classical
  letI : LinearOrder α := IsWellOrder.linearOrder WellOrderingRel
  let u : Finset α := A.sup id
  have hAu : ∀ a ∈ A, a ⊆ u := fun _ ha => Finset.le_sup (f := id) ha
  obtain ⟨f, hf, hup⟩ := exists_representatives A u hAu hunion
  have hinj := good_inj (fun a ha => (hf a ha).1)
  let U := A.image f
  have hUu : ∀ s ∈ U, s ⊆ u := by
    intro s hs
    obtain ⟨a, ha, rfl⟩ := mem_image.mp hs
    exact (hf a ha).2
  have hUp : ∀ s ∈ U, ∀ x ∈ u, insert x s ∈ U := by
    intro s hs x hxu
    obtain ⟨a, ha, rfl⟩ := mem_image.mp hs
    exact hup a ha x hxu
  have hmissing := upper_missing_bound hUu hUp
  have hUcard : U.card = A.card := card_image_of_injOn hinj
  have hmiss_sum : (∑ s ∈ U, ((u.card - s.card : ℕ) : ℝ)) =
      ∑ a ∈ A, ((u.card - (f a).card : ℕ) : ℝ) := sum_image hinj
  rw [hUcard, hmiss_sum] at hmissing
  have hcount := interval_count hf
  have hkraft := kraft_log_bound A hA u.card (fun a => (f a).card - a.card) hcount
  have htotal : (∑ a ∈ A, (((f a).card - a.card : ℕ) : ℝ)) +
      (∑ a ∈ A, ((u.card - (f a).card : ℕ) : ℝ)) +
      (∑ a ∈ A, (a.card : ℝ)) = (A.card : ℝ) * u.card := by
    calc
      _ = ∑ a ∈ A, (((((f a).card - a.card : ℕ) : ℝ)) +
          ((u.card - (f a).card : ℕ) : ℝ) + (a.card : ℝ)) := by
        rw [sum_add_distrib, sum_add_distrib]
      _ = ∑ _a ∈ A, (u.card : ℝ) := by
        apply sum_congr rfl
        intro a ha
        rw [Nat.cast_sub (card_le_card (hf a ha).1.1),
          Nat.cast_sub (card_le_card (hf a ha).2)]
        ring
      _ = _ := by simp
  have htotal' := congrArg (fun r : ℝ => r * Real.log 2) htotal
  nlinarith

end Reimer

theorem problem3 {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  have h := Reimer.main_log A hA hunion
  have hm : (0 : ℝ) < A.card := by exact_mod_cast hA.card_pos
  have hr : (A.card : ℝ) ^ A.card ≤ (2 : ℝ) ^ (2 * ∑ a ∈ A, a.card) := by
    apply (Real.log_le_log_iff (by positivity) (by positivity)).mp
    rw [Real.log_pow, Real.log_pow]
    simpa only [Nat.cast_mul, Nat.cast_ofNat, Nat.cast_sum, mul_assoc] using h
  exact_mod_cast hr
