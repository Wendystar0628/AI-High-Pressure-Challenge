import Mathlib.FieldTheory.ChevalleyWarning
import Mathlib.Algebra.BigOperators.Group.Finset.Powerset
import Mathlib.Algebra.BigOperators.Pi
import Mathlib.Data.Nat.Choose.Lucas
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring
import Mathlib.Tactic.FinCases
import Mathlib.Tactic.IntervalCases
import Mathlib.Tactic.LinearCombination

open Finset MvPolynomial

private lemma alternating_sum_cancel {ι K : Type*} [DecidableEq ι] [CommRing K]
    (s : Finset ι) (a : ι) (ha : a ∈ s) (g : Finset ι → K)
    (hg : ∀ t ⊆ s.erase a, g (insert a t) = g t) :
    ∑ t ∈ s.powerset, (-1 : K) ^ t.card * g t = 0 := by
  classical
  rw [← Finset.insert_erase ha, Finset.sum_powerset_insert (Finset.notMem_erase _ _),
    ← Finset.sum_add_distrib]
  apply Finset.sum_eq_zero
  intro t ht
  have hts := Finset.mem_powerset.mp ht
  have hat : a ∉ t := fun h => (Finset.mem_erase.mp (hts h)).1 rfl
  rw [Finset.card_insert_of_notMem hat, hg t hts, pow_succ]
  ring

private noncomputable def subsetPoint {ι K : Type*} [DecidableEq ι] [Zero K] [One K]
    (s : Finset ι) (i : ι) : K := if i ∈ s then 1 else 0

private lemma alternating_eval_zero {ι K : Type*} [Fintype ι] [DecidableEq ι] [CommRing K]
    (P : MvPolynomial ι K) (hP : P.totalDegree < Fintype.card ι) :
    ∑ s ∈ (Finset.univ : Finset ι).powerset,
      (-1 : K) ^ s.card * MvPolynomial.eval (subsetPoint s) P = 0 := by
  classical
  simp only [MvPolynomial.eval_eq', Finset.mul_sum]
  rw [Finset.sum_comm]
  apply Finset.sum_eq_zero
  intro d hd
  obtain ⟨a, ha⟩ := P.exists_degree_lt 1 (by simpa using hP) hd
  have hda : d a = 0 := by omega
  apply alternating_sum_cancel Finset.univ a (Finset.mem_univ a)
  intro s hs
  congr 1
  apply Finset.prod_congr rfl
  intro i hi
  by_cases he : i = a
  · subst i
    simp [hda]
  · simp [subsetPoint, he]

private noncomputable def zeroCount {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k : ℕ) : ZMod p :=
  ∑ t ∈ s.powersetCard k, if (∑ i ∈ t, f i) = 0 then 1 else 0

private lemma zeroCount_zero {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) : zeroCount f s 0 = 1 := by
  simp only [zeroCount, powersetCard_zero, sum_singleton, sum_empty, ite_true]

private lemma zeroCount_eq_zero {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k : ℕ)
    (h : ∀ t ⊆ s, t.card = k → (∑ i ∈ t, f i) ≠ 0) : zeroCount f s k = 0 := by
  apply Finset.sum_eq_zero
  intro t ht
  rw [if_neg (h t (Finset.mem_powersetCard.mp ht).1 (Finset.mem_powersetCard.mp ht).2)]

private lemma zeroCount_nonzero_exists {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k : ℕ) (h : zeroCount f s k ≠ 0) :
    ∃ t ⊆ s, t.card = k ∧ ∑ i ∈ t, f i = 0 := by
  by_contra! hn
  exact h (zeroCount_eq_zero f s k hn)

private noncomputable def indicatorFactor {ι : Type*} [Fintype ι] {p : ℕ} [Fact p.Prime]
    (w : ι → ZMod p) : MvPolynomial ι (ZMod p) :=
  1 - (∑ i, w i • MvPolynomial.X i) ^ (p - 1)

private lemma indicatorFactor_degree {ι : Type*} [Fintype ι] {p : ℕ} [Fact p.Prime]
    (w : ι → ZMod p) : (indicatorFactor w).totalDegree ≤ p - 1 := by
  have hL : (∑ i, w i • (MvPolynomial.X i : MvPolynomial ι (ZMod p))).totalDegree ≤ 1 := by
    apply totalDegree_finsetSum_le
    intro i hi
    exact (totalDegree_smul_le _ _).trans (by simp)
  apply (totalDegree_sub _ _).trans
  apply max_le
  · simp
  · exact (totalDegree_pow _ _).trans (by simpa using Nat.mul_le_mul_left (p - 1) hL)

private lemma indicatorFactor_eval {ι : Type*} [Fintype ι] [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (w : ι → ZMod p) (s : Finset ι) :
    MvPolynomial.eval (subsetPoint s) (indicatorFactor w) =
      if (∑ i ∈ s, w i) = 0 then 1 else 0 := by
  classical
  have he : MvPolynomial.eval (subsetPoint s)
      (∑ i, w i • (MvPolynomial.X i : MvPolynomial ι (ZMod p))) = ∑ i ∈ s, w i := by
    simp [subsetPoint, Finset.sum_ite, smul_eq_mul]
  rw [indicatorFactor, map_sub, map_one, map_pow, he, ZMod.pow_card_sub_one]
  split_ifs <;> simp_all

private lemma alternating_zero_subsets {ι : Type*} [Fintype ι] [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (f : ι → ZMod p × ZMod p)
    (hcard : 3 * (p - 1) < Fintype.card ι) :
    ∑ s ∈ (Finset.univ : Finset ι).powerset, (-1 : ZMod p) ^ s.card *
      (if p ∣ s.card ∧ (∑ i ∈ s, f i) = 0 then 1 else 0) = 0 := by
  classical
  let P := indicatorFactor (fun _ : ι => (1 : ZMod p)) *
    indicatorFactor (fun i => (f i).1) * indicatorFactor (fun i => (f i).2)
  have hP : P.totalDegree < Fintype.card ι := by
    apply lt_of_le_of_lt _ hcard
    calc
      P.totalDegree ≤ (indicatorFactor (fun _ : ι => (1 : ZMod p)) *
        indicatorFactor (fun i => (f i).1)).totalDegree +
          (indicatorFactor (fun i => (f i).2)).totalDegree := totalDegree_mul _ _
      _ ≤ (p - 1) + (p - 1) + (p - 1) := by
        have h0 := indicatorFactor_degree (fun _ : ι => (1 : ZMod p))
        have h1 := indicatorFactor_degree (fun i => (f i).1)
        have h2 := indicatorFactor_degree (fun i => (f i).2)
        have hh := totalDegree_mul (indicatorFactor (fun _ : ι => (1 : ZMod p)))
          (indicatorFactor (fun i => (f i).1))
        omega
      _ = 3 * (p - 1) := by omega
  have he (s : Finset ι) : MvPolynomial.eval (subsetPoint s) P =
      if p ∣ s.card ∧ (∑ i ∈ s, f i) = 0 then 1 else 0 := by
    simp only [P, map_mul, indicatorFactor_eval, Finset.sum_const, nsmul_eq_mul,
      mul_one, ZMod.natCast_eq_zero_iff]
    have hsum : (∑ i ∈ s, f i) = 0 ↔ (∑ i ∈ s, (f i).1) = 0 ∧
        (∑ i ∈ s, (f i).2) = 0 := by simp [Prod.ext_iff, Prod.fst_sum, Prod.snd_sum]
    simp only [hsum]
    split_ifs <;> simp_all
  simpa only [he] using alternating_eval_zero P hP

private lemma zeroCount_map {ι κ : Type*} [DecidableEq ι] [DecidableEq κ]
    {p : ℕ} [Fact p.Prime] (e : ι ↪ κ) (f : κ → ZMod p × ZMod p)
    (s : Finset ι) (k : ℕ) : zeroCount f (s.map e) k = zeroCount (fun i => f (e i)) s k := by
  simp only [zeroCount, Finset.powersetCard_map, Finset.sum_map, Finset.mapEmbedding_apply]
  apply Finset.sum_congr rfl
  intro t ht
  change (if (∑ i ∈ t.map e, f i) = 0 then (1 : ZMod p) else 0) = _
  rw [Finset.sum_map]

private lemma zeroCount_of_card_lt {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k : ℕ) (hk : s.card < k) :
    zeroCount f s k = 0 := by
  apply zeroCount_eq_zero
  intro t ht htk
  have := Finset.card_le_card ht
  omega

private lemma prime_count_identity_univ {ι : Type*} [Fintype ι] [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (hlo : 3 * (p - 1) < Fintype.card ι) (hhi : Fintype.card ι < 4 * p) :
    1 - zeroCount f Finset.univ p + zeroCount f Finset.univ (2 * p) -
      zeroCount f Finset.univ (3 * p) = 0 := by
  classical
  let F : ℕ → ZMod p := fun k =>
    if p ∣ k then (-1) ^ k * zeroCount f Finset.univ k else 0
  have hsum : (∑ k ∈ Finset.range (Fintype.card ι + 1), F k) = 0 := by
    have hh := alternating_zero_subsets f hlo
    rw [Finset.sum_powerset] at hh
    convert hh using 1
    simp only [Finset.card_univ]
    apply Finset.sum_congr rfl
    intro k hk
    dsimp [F]
    by_cases hd : p ∣ k
    · rw [if_pos hd, zeroCount, Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro t ht
      rw [(Finset.mem_powersetCard.mp ht).2]
      simp only [hd, true_and]
    · rw [if_neg hd]
      symm
      apply Finset.sum_eq_zero
      intro t ht
      rw [(Finset.mem_powersetCard.mp ht).2]
      simp [hd]
  have hbig : (∑ k ∈ Finset.range (4 * p), F k) = 0 := by
    calc
      _ = ∑ k ∈ Finset.range (Fintype.card ι + 1), F k := by
        symm
        apply Finset.sum_subset (Finset.range_mono (by omega))
        intro k hk hkn
        have hc : (Finset.univ : Finset ι).card < k := by
          simp only [Finset.mem_range] at hkn
          simp only [Finset.card_univ]
          omega
        simp [F, zeroCount_of_card_lt f Finset.univ k hc]
      _ = 0 := hsum
  let A : Finset ℕ := {0, p, 2 * p, 3 * p}
  have hA : A ⊆ Finset.range (4 * p) := by
    intro k hk
    simp only [A, Finset.mem_insert, Finset.mem_singleton] at hk
    rcases hk with rfl | rfl | rfl | rfl <;> exact Finset.mem_range.mpr (by omega)
  have heq : (∑ k ∈ A, F k) = ∑ k ∈ Finset.range (4 * p), F k := by
    apply Finset.sum_subset hA
    intro k hk hkA
    by_cases hd : p ∣ k
    · obtain ⟨j, rfl⟩ := hd
      have hj : j < 4 := by nlinarith [Finset.mem_range.mp hk]
      interval_cases j <;> simp [A, Nat.mul_comm] at hkA
    · simp [F, hd]
  have hodd : (-1 : ZMod p) ^ p = -1 :=
    ((Fact.out : p.Prime).odd_of_ne_two (by omega)).neg_one_pow
  rw [hbig] at heq
  have h0 : (0 : ℕ) ∉ ({p, 2 * p, 3 * p} : Finset ℕ) := by
    simp only [Finset.mem_insert, Finset.mem_singleton, not_or]
    omega
  have h1 : p ∉ ({2 * p, 3 * p} : Finset ℕ) := by
    simp only [Finset.mem_insert, Finset.mem_singleton, not_or]
    omega
  have h2 : 2 * p ∉ ({3 * p} : Finset ℕ) := by simp only [Finset.mem_singleton]; omega
  rw [show A = {0, p, 2 * p, 3 * p} from rfl, Finset.sum_insert h0,
    Finset.sum_insert h1, Finset.sum_insert h2, Finset.sum_singleton] at heq
  norm_num [F, pow_mul, hodd, zeroCount_zero, Nat.dvd_mul_left] at heq
  simpa only [sub_eq_add_neg, add_assoc] using heq

private lemma prime_count_identity {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hlo : 3 * (p - 1) < s.card) (hhi : s.card < 4 * p) :
    1 - zeroCount f s p + zeroCount f s (2 * p) - zeroCount f s (3 * p) = 0 := by
  classical
  let e : s ↪ ι := ⟨Subtype.val, Subtype.val_injective⟩
  have he : (Finset.univ : Finset s).map e = s := by ext x; simp [e]
  have hh := prime_count_identity_univ hp2 (fun i : s => f i)
    (by simpa using hlo) (by simpa using hhi)
  have hc (k : ℕ) : zeroCount (fun i : s => f i) Finset.univ k = zeroCount f s k := by
    change zeroCount (fun i => f (e i)) Finset.univ k = _
    rw [← zeroCount_map e f Finset.univ, he]
  simpa only [hc] using hh

private lemma prime_count_three {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hlo : 3 * p - 2 ≤ s.card) (hhi : s.card < 3 * p) :
    1 - zeroCount f s p + zeroCount f s (2 * p) = 0 := by
  have hh := prime_count_identity hp2 f s (by omega) (by omega)
  simpa [zeroCount_of_card_lt f s (3 * p) hhi] using hh

private lemma powersetCard_restrict {ι : Type*} [DecidableEq ι]
    (s t : Finset ι) (hst : t ⊆ s) (k : ℕ) :
    t.powersetCard k = (s.powersetCard k).filter (fun u => u ⊆ t) := by
  ext u
  simp only [Finset.mem_filter, Finset.mem_powersetCard]
  exact ⟨fun h => ⟨⟨h.1.trans hst, h.2⟩, h.1⟩, fun h => ⟨h.2, h.1.2⟩⟩

private lemma zeroCount_lift {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k t : ℕ) (hkt : k ≤ t) :
    (∑ u ∈ s.powersetCard t, zeroCount f u k) =
      ((s.card - k).choose (t - k) : ZMod p) * zeroCount f s k := by
  classical
  calc
    _ = ∑ u ∈ s.powersetCard t, ∑ v ∈ s.powersetCard k,
        if v ⊆ u then (if (∑ i ∈ v, f i) = 0 then (1 : ZMod p) else 0) else 0 := by
      apply Finset.sum_congr rfl
      intro u hu
      rw [zeroCount, powersetCard_restrict s u (Finset.mem_powersetCard.mp hu).1 k,
        Finset.sum_filter]
    _ = ∑ v ∈ s.powersetCard k, ((s.card - k).choose (t - k) : ZMod p) *
        (if (∑ i ∈ v, f i) = 0 then 1 else 0) := by
      rw [Finset.sum_comm]
      apply Finset.sum_congr rfl
      intro v hv
      rw [← Finset.sum_filter, Finset.sum_const, nsmul_eq_mul,
        Finset.card_filter_powersetCard_subset v s t (Finset.mem_powersetCard.mp hv).1
          (by rw [(Finset.mem_powersetCard.mp hv).2]; exact hkt),
        (Finset.mem_powersetCard.mp hv).2]
    _ = _ := by rw [zeroCount, Finset.mul_sum]

private lemma zeroCount_complement {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (k : ℕ) (hk : k ≤ s.card)
    (hs : (∑ i ∈ s, f i) = 0) : zeroCount f s k = zeroCount f s (s.card - k) := by
  classical
  apply Finset.sum_bij (fun t _ => s \ t)
  · intro t ht
    exact Finset.mem_powersetCard.mpr ⟨Finset.sdiff_subset,
      by rw [Finset.card_sdiff_of_subset (Finset.mem_powersetCard.mp ht).1,
        (Finset.mem_powersetCard.mp ht).2]⟩
  · intro t ht u hu he
    have hh := congrArg (fun v => s \ v) he
    simpa only [Finset.sdiff_sdiff_eq_self (Finset.mem_powersetCard.mp ht).1,
      Finset.sdiff_sdiff_eq_self (Finset.mem_powersetCard.mp hu).1] using hh
  · intro u hu
    refine ⟨s \ u, Finset.mem_powersetCard.mpr ⟨Finset.sdiff_subset, ?_⟩,
      Finset.sdiff_sdiff_eq_self (Finset.mem_powersetCard.mp hu).1⟩
    rw [Finset.card_sdiff_of_subset (Finset.mem_powersetCard.mp hu).1,
      (Finset.mem_powersetCard.mp hu).2]
    omega
  · intro t ht
    have hh := Finset.sum_sdiff (f := f) (Finset.mem_powersetCard.mp ht).1
    rw [hs] at hh
    have he := eq_neg_of_add_eq_zero_left hh
    simp [he]

private lemma zero_extensions {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s a : Finset ι) (t : ℕ) (has : a ⊆ s)
    (hat : a.card ≤ t) (ha0 : (∑ i ∈ a, f i) = 0) :
    (∑ u ∈ s.powersetCard t, if a ⊆ u then
      (if (∑ i ∈ u, f i) = 0 then (1 : ZMod p) else 0) else 0) =
        zeroCount f (s \ a) (t - a.card) := by
  classical
  rw [← Finset.sum_filter, Finset.filter_powersetCard_subset a s t has hat]
  rw [Finset.sum_image]
  · apply Finset.sum_congr rfl
    intro u hu
    have hd : Disjoint u a := Finset.disjoint_of_subset_left
      (Finset.mem_powersetCard.mp hu).1 disjoint_sdiff_self_left
    rw [Finset.sum_union hd, ha0, add_zero]
  · intro u hu v hv he
    have hdu : Disjoint u a := Finset.disjoint_of_subset_left
      (Finset.mem_powersetCard.mp hu).1 disjoint_sdiff_self_left
    have hdv : Disjoint v a := Finset.disjoint_of_subset_left
      (Finset.mem_powersetCard.mp hv).1 disjoint_sdiff_self_left
    have hh := congrArg (fun w => w \ a) he
    simpa only [Finset.union_sdiff_cancel_right hdu,
      Finset.union_sdiff_cancel_right hdv] using hh

private lemma zeroCount_double {ι : Type*} [DecidableEq ι] {p : ℕ} [Fact p.Prime]
    (f : ι → ZMod p × ZMod p) (s : Finset ι) (a b : ℕ) (hab : a ≤ b) :
    (∑ u ∈ s.powersetCard b, (if (∑ i ∈ u, f i) = 0 then (1 : ZMod p) else 0) *
      zeroCount f u a) =
    ∑ v ∈ s.powersetCard a, (if (∑ i ∈ v, f i) = 0 then (1 : ZMod p) else 0) *
      zeroCount f (s \ v) (b - a) := by
  classical
  calc
    _ = ∑ u ∈ s.powersetCard b, ∑ v ∈ s.powersetCard a,
        (if (∑ i ∈ v, f i) = 0 then (1 : ZMod p) else 0) *
          (if v ⊆ u then (if (∑ i ∈ u, f i) = 0 then 1 else 0) else 0) := by
      apply Finset.sum_congr rfl
      intro u hu
      rw [zeroCount, powersetCard_restrict s u (Finset.mem_powersetCard.mp hu).1 a,
        Finset.sum_filter, Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro v hv
      split_ifs <;> ring
    _ = _ := by
      rw [Finset.sum_comm]
      apply Finset.sum_congr rfl
      intro v hv
      rw [← Finset.mul_sum]
      by_cases hv0 : (∑ i ∈ v, f i) = 0
      · rw [zero_extensions f s v b (Finset.mem_powersetCard.mp hv).1
          (by rw [(Finset.mem_powersetCard.mp hv).2]; exact hab) hv0,
          (Finset.mem_powersetCard.mp hv).2]
      · simp [hv0]

private lemma zeroCount_insert_zero {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (a : ι) (ha : a ∉ s) (hfa : f a = 0)
    (k : ℕ) (hk : 0 < k) :
    zeroCount f (insert a s) k = zeroCount f s k + zeroCount f s (k - 1) := by
  classical
  obtain ⟨j, rfl⟩ := Nat.exists_eq_succ_of_ne_zero hk.ne'
  rw [zeroCount, Finset.powersetCard_succ_insert ha, Finset.sum_union]
  · congr 1
    rw [Finset.sum_image]
    · apply Finset.sum_congr rfl
      intro t ht
      have hat : a ∉ t := fun h => ha ((Finset.mem_powersetCard.mp ht).1 h)
      rw [Finset.sum_insert hat, hfa, zero_add]
    · intro t ht u hu he
      have hat : a ∉ t := fun h => ha ((Finset.mem_powersetCard.mp ht).1 h)
      have hau : a ∉ u := fun h => ha ((Finset.mem_powersetCard.mp hu).1 h)
      have hh := congrArg (fun v => v.erase a) he
      simpa [hat, hau] using hh
  · apply Finset.disjoint_left.mpr
    intro t ht hti
    obtain ⟨u, hu, rfl⟩ := Finset.mem_image.mp hti
    exact ha ((Finset.mem_powersetCard.mp ht).1 (Finset.mem_insert_self a u))

private lemma prime_count_augmented {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hlo : 3 * p - 3 ≤ s.card) (hhi : s.card + 1 < 4 * p) :
    1 - (zeroCount f s p + zeroCount f s (p - 1)) +
      (zeroCount f s (2 * p) + zeroCount f s (2 * p - 1)) -
      (zeroCount f s (3 * p) + zeroCount f s (3 * p - 1)) = 0 := by
  classical
  let e : ι ↪ Option ι := ⟨Option.some, Option.some_injective ι⟩
  let g : Option ι → ZMod p × ZMod p := fun x => x.elim 0 f
  have hnone : none ∉ s.map e := by simp [e]
  have hcard : (insert none (s.map e)).card = s.card + 1 := by simp [hnone]
  have hh := prime_count_identity hp2 g (insert none (s.map e))
    (by rw [hcard]; omega) (by rw [hcard]; exact hhi)
  have hc (k : ℕ) (hk : 0 < k) : zeroCount g (insert none (s.map e)) k =
      zeroCount f s k + zeroCount f s (k - 1) := by
    rw [zeroCount_insert_zero g (s.map e) none hnone (by rfl) k hk,
      zeroCount_map, zeroCount_map]
    rfl
  simpa only [hc p (by omega), hc (2 * p) (by omega), hc (3 * p) (by omega)] using hh

private lemma choose_shift_mod {p : ℕ} [Fact p.Prime] (a b c : ℕ)
    (ha : 0 < a) (hb : 0 < b) (hc : 0 < c) (hcp : c ≤ p) :
    ((a * p - c).choose (b * p - c) : ZMod p) = ((a - 1).choose (b - 1) : ZMod p) := by
  have hp : 0 < p := (Fact.out : p.Prime).pos
  have hex (d : ℕ) (hd : 0 < d) : d * p - c = (p - c) + (d - 1) * p := by
    have hh := Nat.mul_le_mul_right p hd
    rw [Nat.sub_mul]
    omega
  have hmod (d : ℕ) (hd : 0 < d) : (d * p - c) % p = p - c := by
    rw [hex d hd, Nat.add_mul_mod_self_right, Nat.mod_eq_of_lt (by omega)]
  have hdiv (d : ℕ) (hd : 0 < d) : (d * p - c) / p = d - 1 := by
    rw [hex d hd, Nat.add_mul_div_right _ _ hp, Nat.div_eq_of_lt (by omega), zero_add]
  have hh := (ZMod.natCast_eq_natCast_iff _ _ p).mpr
    (Choose.choose_modEq_choose_mod_mul_choose_div_nat
      (n := a * p - c) (k := b * p - c) (p := p))
  simpa only [hmod a ha, hmod b hb, hdiv a ha, hdiv b hb, Nat.choose_self, one_mul] using hh

private lemma prime_count_lifted {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hcard : s.card = 4 * p - 3) :
    3 - 2 * zeroCount f s (p - 1) - 2 * zeroCount f s p +
      zeroCount f s (2 * p - 1) + zeroCount f s (2 * p) = 0 := by
  classical
  have hh : (∑ t ∈ s.powersetCard (3 * p - 3),
      (1 - zeroCount f t (p - 1) - zeroCount f t p +
        zeroCount f t (2 * p - 1) + zeroCount f t (2 * p))) = 0 := by
    apply Finset.sum_eq_zero
    intro t ht
    have htcard := (Finset.mem_powersetCard.mp ht).2
    have h := prime_count_augmented hp2 f t (by omega) (by omega)
    rw [zeroCount_of_card_lt f t (3 * p) (by omega),
      zeroCount_of_card_lt f t (3 * p - 1) (by omega)] at h
    linear_combination h
  simp only [Finset.sum_add_distrib, Finset.sum_sub_distrib, Finset.sum_const,
    nsmul_eq_mul, mul_one, Finset.card_powersetCard] at hh
  rw [zeroCount_lift f s (p - 1) (3 * p - 3) (by omega),
    zeroCount_lift f s p (3 * p - 3) (by omega),
    zeroCount_lift f s (2 * p - 1) (3 * p - 3) (by omega),
    zeroCount_lift f s (2 * p) (3 * p - 3) (by omega), hcard] at hh
  have h0 : (((4 * p - 3).choose (3 * p - 3)) : ZMod p) = 3 := by
    simpa using choose_shift_mod (p := p) 4 3 3 (by omega) (by omega) (by omega) (by omega)
  have h1 : (((4 * p - 3 - (p - 1)).choose (3 * p - 3 - (p - 1))) : ZMod p) = 2 := by
    convert choose_shift_mod (p := p) 3 2 2 (by omega) (by omega) (by omega) (by omega) using 1 <;>
      first | congr 2 <;> omega | norm_num
  have h2 : (((4 * p - 3 - p).choose (3 * p - 3 - p)) : ZMod p) = 2 := by
    convert choose_shift_mod (p := p) 3 2 3 (by omega) (by omega) (by omega) (by omega) using 1 <;>
      first | congr 2 <;> omega | norm_num
  have h3 : (((4 * p - 3 - (2 * p - 1)).choose (3 * p - 3 - (2 * p - 1))) : ZMod p) = 1 := by
    convert choose_shift_mod (p := p) 2 1 2 (by omega) (by omega) (by omega) (by omega) using 1 <;>
      first | congr 2 <;> omega | norm_num
  have h4 : (((4 * p - 3 - 2 * p).choose (3 * p - 3 - 2 * p)) : ZMod p) = 1 := by
    convert choose_shift_mod (p := p) 2 1 3 (by omega) (by omega) (by omega) (by omega) using 1 <;>
      first | congr 2 <;> omega | norm_num
  simpa only [h0, h1, h2, h3, h4, one_mul] using hh

private lemma three_p_zero_forces_p {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hcard : s.card = 3 * p) (hsum : (∑ i ∈ s, f i) = 0) :
    ∃ t ⊆ s, t.card = p ∧ ∑ i ∈ t, f i = 0 := by
  classical
  by_contra! hno
  obtain ⟨a, ha⟩ := Finset.card_pos.mp (show 0 < s.card by omega)
  have hc : (s.erase a).card = 3 * p - 1 := by rw [Finset.card_erase_of_mem ha, hcard]
  have hz : zeroCount f (s.erase a) p = 0 :=
    zeroCount_eq_zero f (s.erase a) p (fun t ht => hno t (ht.trans (Finset.erase_subset _ _)))
  have hh := prime_count_three hp2 f (s.erase a) (by omega) (by omega)
  have hne : zeroCount f (s.erase a) (2 * p) ≠ 0 := by
    intro he
    rw [hz, he] at hh
    norm_num at hh
  obtain ⟨u, hu, huc, hus⟩ := zeroCount_nonzero_exists f (s.erase a) (2 * p) hne
  have husub : u ⊆ s := hu.trans (Finset.erase_subset _ _)
  apply hno (s \ u) Finset.sdiff_subset
  · rw [Finset.card_sdiff_of_subset husub, hcard, huc]
    omega
  · have he := Finset.sum_sdiff (f := f) husub
    simpa [hus, hsum] using he

private lemma prime_count_adjacent {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hcard : s.card = 4 * p - 3)
    (hno : ∀ t ⊆ s, t.card = p → (∑ i ∈ t, f i) ≠ 0) :
    zeroCount f s (p - 1) = zeroCount f s (3 * p - 1) := by
  classical
  have hinner (t : Finset ι) (ht : t ⊆ s)
      (hc1 : 3 * p - 2 ≤ t.card) (hc2 : t.card < 3 * p) : zeroCount f t (2 * p) = -1 := by
    have hz := zeroCount_eq_zero f t p (fun u hu => hno u (hu.trans ht))
    have hh := prime_count_three hp2 f t hc1 hc2
    rw [hz] at hh
    linear_combination hh
  have hd := zeroCount_double f s (p - 1) (3 * p - 1) (by omega)
  have hleft : (∑ u ∈ s.powersetCard (3 * p - 1),
      (if (∑ i ∈ u, f i) = 0 then (1 : ZMod p) else 0) * zeroCount f u (p - 1)) =
      -zeroCount f s (3 * p - 1) := by
    rw [zeroCount, ← Finset.sum_neg_distrib]
    apply Finset.sum_congr rfl
    intro u hu
    obtain ⟨hus, huc⟩ := Finset.mem_powersetCard.mp hu
    by_cases hu0 : (∑ i ∈ u, f i) = 0
    · simp only [hu0, if_true, one_mul]
      rw [zeroCount_complement f u (p - 1) (by omega) hu0,
        show u.card - (p - 1) = 2 * p by omega]
      exact hinner u hus (by omega) (by omega)
    · simp [hu0]
  have hright : (∑ v ∈ s.powersetCard (p - 1),
      (if (∑ i ∈ v, f i) = 0 then (1 : ZMod p) else 0) *
        zeroCount f (s \ v) ((3 * p - 1) - (p - 1))) = -zeroCount f s (p - 1) := by
    rw [zeroCount, ← Finset.sum_neg_distrib]
    apply Finset.sum_congr rfl
    intro v hv
    obtain ⟨hvs, hvc⟩ := Finset.mem_powersetCard.mp hv
    have hsc : (s \ v).card = 3 * p - 2 := by
      rw [Finset.card_sdiff_of_subset hvs, hcard, hvc]
      omega
    rw [show (3 * p - 1) - (p - 1) = 2 * p by omega,
      hinner (s \ v) Finset.sdiff_subset (by omega) (by omega)]
    split_ifs <;> ring
  rw [hleft, hright] at hd
  exact neg_injective hd.symm

private theorem kemnitz_odd_prime {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (hp2 : 2 < p) (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hcard : s.card = 4 * p - 3) :
    ∃ t ⊆ s, t.card = p ∧ ∑ i ∈ t, f i = 0 := by
  classical
  by_contra! hno
  have hzp : zeroCount f s p = 0 := zeroCount_eq_zero f s p hno
  have hz3 : zeroCount f s (3 * p) = 0 := by
    apply zeroCount_eq_zero
    intro t ht htc ht0
    obtain ⟨u, hu, huc, hu0⟩ := three_p_zero_forces_p hp2 f t htc ht0
    exact hno u (hu.trans ht) huc hu0
  have haug := prime_count_augmented hp2 f s (by omega) (by omega)
  have hlift := prime_count_lifted hp2 f s hcard
  have hadj := prime_count_adjacent hp2 f s hcard hno
  rw [hzp, hz3] at haug
  rw [hzp] at hlift
  have he : (2 : ZMod p) = 0 := by linear_combination hlift - haug + hadj
  exact Nat.not_dvd_of_pos_of_lt (by norm_num) hp2 ((ZMod.natCast_eq_zero_iff 2 p).mp he)

private theorem kemnitz_two {ι : Type*} [DecidableEq ι]
    (f : ι → ZMod 2 × ZMod 2) (s : Finset ι) (hcard : s.card = 5) :
    ∃ t ⊆ s, t.card = 2 ∧ ∑ i ∈ t, f i = 0 := by
  classical
  have hc : (Finset.univ : Finset (ZMod 2 × ZMod 2)).card < s.card := by
    simp [hcard, Fintype.card_prod, ZMod.card]
  obtain ⟨x, hx, y, hy, hxy, he⟩ := Finset.exists_ne_map_eq_of_card_lt_of_maps_to
    hc (f := f) (fun _ _ => Finset.mem_univ _)
  refine ⟨{x, y}, by simp [Finset.insert_subset_iff, hx, hy], by simp [hxy], ?_⟩
  simp only [Finset.sum_pair hxy, he]
  apply Prod.ext <;> change _ + _ = (0 : ZMod 2) <;>
    rw [← two_mul, show (2 : ZMod 2) = 0 from ZMod.natCast_self 2, zero_mul]

private theorem kemnitz_prime {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (f : ι → ZMod p × ZMod p)
    (s : Finset ι) (hcard : s.card = 4 * p - 3) :
    ∃ t ⊆ s, t.card = p ∧ ∑ i ∈ t, f i = 0 := by
  by_cases hp2 : p = 2
  · subst p
    exact kemnitz_two f s (by simpa using hcard)
  · exact kemnitz_odd_prime (by have := (Fact.out : p.Prime).two_le; omega) f s hcard

private theorem int_kemnitz_prime {ι : Type*} [DecidableEq ι]
    {p : ℕ} [Fact p.Prime] (a b : ι → ℤ) (s : Finset ι)
    (hs : s.card = 4 * p - 3) :
    ∃ t ⊆ s, t.card = p ∧ (p : ℤ) ∣ ∑ i ∈ t, a i ∧ (p : ℤ) ∣ ∑ i ∈ t, b i := by
  obtain ⟨t, hts, htc, ht⟩ := kemnitz_prime (fun i => ((a i : ZMod p), (b i : ZMod p))) s hs
  refine ⟨t, hts, htc, ?_, ?_⟩
  · have h := congrArg Prod.fst ht
    simpa [Prod.fst_sum, ← Int.cast_sum, ZMod.intCast_zmod_eq_zero_iff_dvd] using h
  · have h := congrArg Prod.snd ht
    simpa [Prod.snd_sum, ← Int.cast_sum, ZMod.intCast_zmod_eq_zero_iff_dvd] using h

private theorem int_kemnitz {ι : Type*} (n : ℕ) (a b : ι → ℤ) (s : Finset ι)
    (hs : 4 * n - 3 ≤ s.card) :
    ∃ t ⊆ s, t.card = n ∧ (n : ℤ) ∣ ∑ i ∈ t, a i ∧ (n : ℤ) ∣ ∑ i ∈ t, b i := by
  classical
  induction n using Nat.prime_composite_induction generalizing ι with
  | zero => exact ⟨∅, by simp⟩
  | one => simpa using exists_subset_card_eq hs
  | prime p hp =>
    have := Fact.mk hp
    obtain ⟨t, hts, ht⟩ := exists_subset_card_eq hs
    obtain ⟨u, hut, hu⟩ := int_kemnitz_prime a b t ht
    exact ⟨u, hut.trans hts, hu⟩
  | composite m hm ihm n hn ihn =>
    suffices ∀ k ≤ 4 * m - 3, ∃ A : Finset (Finset ι), A.card = k ∧
        (A : Set (Finset ι)).Pairwise _root_.Disjoint ∧
        ∀ ⦃t⦄, t ∈ A → t ⊆ s ∧ t.card = n ∧
          (n : ℤ) ∣ ∑ i ∈ t, a i ∧ (n : ℤ) ∣ ∑ i ∈ t, b i by
      obtain ⟨A, hAc, hAd, hA⟩ := this _ le_rfl
      obtain ⟨B, hBA, hBc, hBa, hBb⟩ := ihm
        (fun t => (∑ i ∈ t, a i) / n) (fun t => (∑ i ∈ t, b i) / n) A hAc.ge
      refine ⟨B.biUnion (fun x => x), biUnion_subset.2 (fun t ht => (hA (hBA ht)).1), ?_, ?_, ?_⟩
      · rw [card_biUnion (hAd.mono hBA), sum_const_nat (fun t ht => (hA (hBA ht)).2.1), hBc]
      · rwa [sum_biUnion, Int.natCast_mul, mul_comm, ← Int.dvd_div_iff_mul_dvd, Int.sum_div]
        · exact fun t ht => (hA (hBA ht)).2.2.1
        · exact dvd_sum (fun t ht => (hA (hBA ht)).2.2.1)
        · exact hAd.mono hBA
      · rwa [sum_biUnion, Int.natCast_mul, mul_comm, ← Int.dvd_div_iff_mul_dvd, Int.sum_div]
        · exact fun t ht => (hA (hBA ht)).2.2.2
        · exact dvd_sum (fun t ht => (hA (hBA ht)).2.2.2)
        · exact hAd.mono hBA
    intro k hk
    induction k with
    | zero => exact ⟨∅, by simp⟩
    | succ k ih =>
      obtain ⟨A, hAc, hAd, hA⟩ := ih (Nat.le_of_succ_le hk)
      have hremain : 4 * n - 3 ≤ (s \ A.biUnion id).card := by
        calc
          _ ≤ (4 * m - k) * n - 3 := by gcongr; omega
          _ = (4 * (m * n) - 3) - ∑ t ∈ A, t.card := by
            rw [tsub_mul, mul_assoc, tsub_right_comm,
              sum_const_nat (fun t ht => (hA ht).2.1), hAc]
          _ ≤ s.card - (A.biUnion id).card := by gcongr; exact card_biUnion_le
          _ ≤ (s \ A.biUnion id).card := le_card_sdiff ..
      obtain ⟨t, ht, htc, hta, htb⟩ := ihn a b _ hremain
      have hnot : t ∉ A := by
        intro h
        have hz : n = 0 := by
          simpa [← card_eq_zero, htc] using
            sdiff_disjoint.mono ht (subset_biUnion_of_mem id h)
        omega
      refine ⟨A.cons t hnot, by rw [card_cons, hAc], ?_, ?_⟩
      · simp only [cons_eq_insert, coe_insert, Set.pairwise_insert_of_symm, mem_coe, ne_eq]
        exact ⟨hAd, fun u hu _ => sdiff_disjoint.mono ht (subset_biUnion_of_mem id hu)⟩
      · simp only [cons_eq_insert, mem_insert, forall_eq_or_imp, and_assoc]
        exact ⟨ht.trans sdiff_subset, htc, hta, htb, hA⟩

theorem problem8 (n : ℕ) (hn : 1 ≤ n)
    (f : Fin (4 * n - 3) → ZMod n × ZMod n) :
    ∃ s : Finset (Fin (4 * n - 3)),
      s.card = n ∧ ∑ i ∈ s, f i = 0 := by
  classical
  obtain ⟨s, _, hsc, hsa, hsb⟩ := int_kemnitz n
    (fun i => ZMod.cast (f i).1) (fun i => ZMod.cast (f i).2)
    Finset.univ (by simp)
  refine ⟨s, hsc, Prod.ext ?_ ?_⟩
  · simpa [Prod.fst_sum, ← ZMod.intCast_zmod_eq_zero_iff_dvd] using hsa
  · simpa [Prod.snd_sum, ← ZMod.intCast_zmod_eq_zero_iff_dvd] using hsb
