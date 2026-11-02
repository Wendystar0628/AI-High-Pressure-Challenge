import Mathlib.FieldTheory.Finite.Basic
import Mathlib.Algebra.MvPolynomial.CommRing
import Mathlib.Algebra.BigOperators.Group.Finset.Powerset
import Mathlib.Data.Nat.Choose.Lucas
import Mathlib.Tactic.Ring
import Mathlib.Tactic.GCongr
import Mathlib.Tactic.LinearCombination
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.IntervalCases
import Mathlib.Data.Nat.Factorization.Induction
import Mathlib.Algebra.CharP.Two

open Finset MvPolynomial

namespace Kemnitz

variable {α : Type*} [DecidableEq α]

lemma alternating_vanish {R : Type*} [CommRing R] (s : Finset α)
    (P : MvPolynomial α R) (hP : P.totalDegree < s.card) :
    ∑ t ∈ s.powerset, (-1 : R) ^ t.card *
      eval (fun i => if i ∈ t then 1 else 0) P = 0 := by
  classical
  simp_rw [eval_eq, mul_sum]
  rw [sum_comm]
  apply sum_eq_zero
  intro d hd
  have hcard : d.support.card ≤ P.totalDegree := by
    calc
      d.support.card = ∑ i ∈ d.support, 1 := by simp
      _ ≤ ∑ i ∈ d.support, d i := by
        apply sum_le_sum
        intro i hi
        exact Nat.one_le_iff_ne_zero.mpr (Finsupp.mem_support_iff.mp hi)
      _ ≤ P.totalDegree := le_totalDegree hd
  obtain ⟨i, hi, hdi⟩ : ∃ i ∈ s, i ∉ d.support := by
    by_contra h
    push_neg at h
    have : s ⊆ d.support := h
    have := card_le_card this
    omega
  have hzero : d i = 0 := Finsupp.notMem_support_iff.mp hdi
  rw [← insert_erase hi, sum_powerset_insert (notMem_erase i s), ← sum_add_distrib]
  apply sum_eq_zero
  intro t ht
  have hit : i ∉ t := notMem_mono (mem_powerset.mp ht) (notMem_erase i s)
  have heq : (∏ j ∈ d.support, (if j ∈ insert i t then (1 : R) else 0) ^ d j) =
      ∏ j ∈ d.support, (if j ∈ t then (1 : R) else 0) ^ d j := by
    apply prod_congr rfl
    intro j hj
    have : j ≠ i := by rintro rfl; exact hdi hj
    simp [this]
  rw [card_insert_of_notMem hit, pow_succ, heq]
  ring

noncomputable def lin {R : Type*} [CommRing R] (s : Finset α) (a : α → R) :
    MvPolynomial α R := ∑ i ∈ s, C (a i) * X i

lemma degree_lin {R : Type*} [CommRing R] [Nontrivial R] (s : Finset α) (a : α → R) :
    (lin s a).totalDegree ≤ 1 := by
  apply totalDegree_finsetSum_le
  intro i hi
  exact (totalDegree_mul _ _).trans (by simpa using (totalDegree_X (R := R) i).le)

lemma eval_lin {R : Type*} [CommRing R] (s t : Finset α) (a : α → R) (ht : t ⊆ s) :
    eval (fun i => if i ∈ t then 1 else 0) (lin s a) = ∑ i ∈ t, a i := by
  classical
  simp only [lin, map_sum, map_mul, eval_C, eval_X, mul_ite, mul_one, mul_zero]
  rw [← sum_filter]
  congr 1
  ext i
  simp only [mem_filter]
  exact and_iff_right_of_imp (fun hi => ht hi)

lemma degree_shift_pow {R : Type*} [CommRing R] (L : MvPolynomial α R)
    (hL : L.totalDegree ≤ 1) (m : ℕ) :
    ((L + 1) ^ m - L ^ m).totalDegree ≤ m - 1 := by
  induction m with
  | zero => simp
  | succ m ih =>
    cases m with
    | zero => simp
    | succ m =>
      have heq : (L + 1) ^ (m + 1 + 1) - L ^ (m + 1 + 1) =
          (L + 1) * ((L + 1) ^ (m + 1) - L ^ (m + 1)) + L ^ (m + 1) := by
        ring
      rw [heq]
      apply (totalDegree_add _ _).trans
      apply max_le
      · apply (totalDegree_mul _ _).trans
        have : (L + 1).totalDegree ≤ 1 :=
          (totalDegree_add _ _).trans (by simpa using hL)
        omega
      · exact (totalDegree_pow _ _).trans (by simpa using Nat.mul_le_mul_left (m + 1) hL)

section Prime
variable {p : ℕ} [Fact p.Prime]

noncomputable def count (f : α → ZMod p × ZMod p) (s : Finset α) (k : ℕ) : ZMod p :=
  ∑ t ∈ s.powerset, if t.card = k ∧ ∑ i ∈ t, f i = 0 then 1 else 0

noncomputable def alt (f : α → ZMod p × ZMod p) (s : Finset α) (r : ZMod p) : ZMod p :=
  ∑ t ∈ s.powerset, if (t.card : ZMod p) + r = 0 ∧ ∑ i ∈ t, f i = 0
    then (-1) ^ t.card else 0

noncomputable def coords (f : α → ZMod p × ZMod p) (s : Finset α) :
    MvPolynomial α (ZMod p) :=
  (1 - lin s (fun i => (f i).1) ^ (p - 1)) *
    (1 - lin s (fun i => (f i).2) ^ (p - 1))

noncomputable def lengthPoly (s : Finset α) (r : ZMod p) :
    MvPolynomial α (ZMod p) := 1 - (lin s (fun _ => 1) + C r) ^ (p - 1)

lemma degree_indicator (L : MvPolynomial α (ZMod p)) (hL : L.totalDegree ≤ 1) :
    (1 - L ^ (p - 1)).totalDegree ≤ p - 1 := by
  apply (totalDegree_sub _ _).trans
  apply max_le
  · simp
  · exact (totalDegree_pow _ _).trans (by simpa using Nat.mul_le_mul_left (p - 1) hL)

lemma degree_coords (f : α → ZMod p × ZMod p) (s : Finset α) :
    (coords f s).totalDegree ≤ 2 * (p - 1) := by
  apply (totalDegree_mul _ _).trans
  have h₁ := degree_indicator (lin s (fun i => (f i).1)) (degree_lin ..)
  have h₂ := degree_indicator (lin s (fun i => (f i).2)) (degree_lin ..)
  omega

lemma indicator_value (x : ZMod p) : 1 - x ^ (p - 1) = if x = 0 then 1 else 0 := by
  rw [ZMod.pow_card_sub_one]
  split_ifs <;> simp_all

lemma eval_coords (f : α → ZMod p × ZMod p) (s t : Finset α) (ht : t ⊆ s) :
    eval (fun i => if i ∈ t then 1 else 0) (coords f s) =
      if ∑ i ∈ t, f i = 0 then 1 else 0 := by
  simp only [coords, map_mul, map_sub, map_one, map_pow, eval_lin s t _ ht]
  rw [indicator_value, indicator_value]
  have : (∑ i ∈ t, f i = 0) ↔
      (∑ i ∈ t, (f i).1 = 0) ∧ (∑ i ∈ t, (f i).2 = 0) := by
    simp only [Prod.ext_iff, Prod.fst_sum, Prod.snd_sum, Prod.fst_zero, Prod.snd_zero]
  simp only [this]
  split_ifs <;> simp_all

lemma eval_length (s t : Finset α) (ht : t ⊆ s) (r : ZMod p) :
    eval (fun i => if i ∈ t then 1 else 0) (lengthPoly s r) =
      if (t.card : ZMod p) + r = 0 then 1 else 0 := by
  simp only [lengthPoly, map_sub, map_one, map_pow, map_add, eval_C, eval_lin s t _ ht,
    sum_const, nsmul_eq_mul, mul_one]
  exact indicator_value _

lemma alt_zero (f : α → ZMod p × ZMod p) (s : Finset α) (r : ZMod p)
    (hs : 3 * (p - 1) < s.card) : alt f s r = 0 := by
  have hL : (lengthPoly s r).totalDegree ≤ p - 1 :=
    degree_indicator _ ((totalDegree_add _ _).trans (by simpa using degree_lin s (fun _ => (1 : ZMod p))))
  have hQ := degree_coords f s
  have h := alternating_vanish s (lengthPoly s r * coords f s)
    ((totalDegree_mul _ _).trans_lt (by omega))
  convert h using 1
  apply sum_congr rfl
  intro t ht
  rw [map_mul, eval_length s t (mem_powerset.mp ht), eval_coords f s t (mem_powerset.mp ht)]
  split_ifs <;> simp_all

lemma alt_equal (f : α → ZMod p × ZMod p) (s : Finset α)
    (hs : 3 * (p - 1) ≤ s.card) : alt f s 0 = alt f s 1 := by
  have hp := (Fact.out : p.Prime).two_le
  have hD := degree_shift_pow (lin s (fun _ => (1 : ZMod p))) (degree_lin ..) (p - 1)
  have hQ := degree_coords f s
  have h := alternating_vanish s
    (((lin s (fun _ => (1 : ZMod p)) + 1) ^ (p - 1) -
      lin s (fun _ => (1 : ZMod p)) ^ (p - 1)) * coords f s)
    ((totalDegree_mul _ _).trans_lt (by omega))
  have heq : ((lin s (fun _ => (1 : ZMod p)) + 1) ^ (p - 1) -
      lin s (fun _ => (1 : ZMod p)) ^ (p - 1)) = lengthPoly s 0 - lengthPoly s 1 := by
    simp only [lengthPoly, map_zero, add_zero, map_one]
    ring
  rw [heq, sub_mul] at h
  simp only [map_sub, map_mul, mul_sub, sum_sub_distrib] at h
  apply sub_eq_zero.mp
  convert h using 1
  congr 1 <;>
    apply sum_congr rfl <;>
    intro t ht <;>
    rw [eval_length s t (mem_powerset.mp ht), eval_coords f s t (mem_powerset.mp ht)] <;>
    split_ifs <;> simp_all

lemma count_zero (f : α → ZMod p × ZMod p) (s : Finset α) : count f s 0 = 1 := by
  classical
  have h : ∀ t : Finset α, (t.card = 0 ∧ ∑ i ∈ t, f i = 0) ↔ t = ∅ := by
    intro t
    constructor
    · exact fun ht => card_eq_zero.mp ht.1
    · rintro rfl; simp
  simp only [count, h]
  simp

lemma count_vanish (f : α → ZMod p × ZMod p) (s : Finset α) (k : ℕ)
    (h : ∀ t ⊆ s, t.card = k → ∑ i ∈ t, f i ≠ 0) : count f s k = 0 := by
  apply sum_eq_zero
  intro t ht
  split_ifs with hc
  · exact (h t (mem_powerset.mp ht) hc.1 hc.2).elim
  · rfl

lemma count_large (f : α → ZMod p × ZMod p) (s : Finset α) (k : ℕ)
    (h : s.card < k) : count f s k = 0 := by
  apply count_vanish
  intro t ht hc
  have := card_le_card ht
  omega

lemma multiples_lt_four {k p : ℕ} (hp : 0 < p) (hk : k < 4 * p) (hd : p ∣ k) :
    k = 0 ∨ k = p ∨ k = 2 * p ∨ k = 3 * p := by
  obtain ⟨q, rfl⟩ := hd
  have hq : q < 4 := by nlinarith
  interval_cases q <;> omega

lemma alt_expand_zero (f : α → ZMod p × ZMod p) (s : Finset α)
    (hp : Odd p) (hs : s.card < 4 * p) :
    alt f s 0 = 1 - count f s p + count f s (2 * p) - count f s (3 * p) := by
  classical
  rw [← count_zero f s]
  simp only [alt, count, ← sum_sub_distrib, ← sum_add_distrib]
  apply sum_congr rfl
  intro t ht
  have hb : t.card < 4 * p := (card_le_card (mem_powerset.mp ht)).trans_lt hs
  have hpos := (Fact.out : p.Prime).pos
  have hsign : (-1 : ZMod p) ^ p = -1 := hp.neg_one_pow
  have hsign₂ : (-1 : ZMod p) ^ (2 * p) = 1 := by rw [mul_comm 2 p, pow_mul, hsign]; norm_num
  have hsign₃ : (-1 : ZMod p) ^ (3 * p) = -1 := by rw [mul_comm 3 p, pow_mul, hsign]; norm_num
  have hn₀ : p ≠ 0 := by omega
  have hn₂ : p ≠ 2 * p := by omega
  have hn₃ : p ≠ 3 * p := by omega
  have hn₂₃ : 2 * p ≠ 3 * p := by omega
  by_cases hz : ∑ i ∈ t, f i = 0
  · by_cases hd : p ∣ t.card
    · have hc := multiples_lt_four hpos hb hd
      rcases hc with hc | hc | hc | hc <;>
        simp [hc, hz, hsign, hsign₂, hsign₃, hn₀, Ne.symm hn₀, hn₂, Ne.symm hn₂,
          hn₃, Ne.symm hn₃, hn₂₃, Ne.symm hn₂₃]
    · have hcast : (t.card : ZMod p) ≠ 0 := by
        exact fun h => hd ((CharP.cast_eq_zero_iff (ZMod p) p _).mp h)
      have h₀ : t.card ≠ 0 := by rintro h; exact hd (h ▸ dvd_zero p)
      have h₁ : t.card ≠ p := by rintro h; exact hd (h ▸ dvd_refl p)
      have h₂ : t.card ≠ 2 * p := by rintro h; apply hd; rw [h]; exact dvd_mul_left p 2
      have h₃ : t.card ≠ 3 * p := by rintro h; apply hd; rw [h]; exact dvd_mul_left p 3
      simp [hz, hcast, h₀, h₁, h₂, h₃]
  · simp [hz]

lemma alt_expand_one (f : α → ZMod p × ZMod p) (s : Finset α)
    (hp : Odd p) (hs : s.card + 1 < 4 * p) :
    alt f s 1 = count f s (p - 1) - count f s (2 * p - 1) + count f s (3 * p - 1) := by
  classical
  simp only [alt, count, ← sum_sub_distrib, ← sum_add_distrib]
  apply sum_congr rfl
  intro t ht
  have hpos := (Fact.out : p.Prime).pos
  have hb : t.card + 1 < 4 * p := by have := card_le_card (mem_powerset.mp ht); omega
  have hs₁ : (-1 : ZMod p) ^ (p - 1) = 1 := (Nat.Odd.sub_odd hp (by decide : Odd 1)).neg_one_pow
  have hs₂ : (-1 : ZMod p) ^ (2 * p - 1) = -1 := by
    have he : Even (2 * p) := even_two_mul p
    exact (Nat.Even.sub_odd (by omega) he (by decide : Odd 1)).neg_one_pow
  have hs₃ : (-1 : ZMod p) ^ (3 * p - 1) = 1 :=
    (Nat.Odd.sub_odd (Odd.mul (by decide : Odd 3) hp) (by decide : Odd 1)).neg_one_pow
  have hcast : (t.card : ZMod p) + 1 = 0 ↔ p ∣ t.card + 1 := by
    rw [← Nat.cast_one, ← Nat.cast_add, CharP.cast_eq_zero_iff]
  have hn₁₂ : p - 1 ≠ 2 * p - 1 := by omega
  have hn₁₃ : p - 1 ≠ 3 * p - 1 := by omega
  have hn₂₃ : 2 * p - 1 ≠ 3 * p - 1 := by omega
  by_cases hz : ∑ i ∈ t, f i = 0
  · by_cases hd : p ∣ t.card + 1
    · have hc := multiples_lt_four hpos hb hd
      rw [if_pos ⟨hcast.mpr hd, hz⟩]
      rcases hc with hc | hc | hc | hc
      · omega
      all_goals have hc' : t.card = _ := Nat.eq_sub_of_add_eq hc
      all_goals simp [hc', hz, hs₁, hs₂, hs₃, hn₁₂, Ne.symm hn₁₂,
        hn₁₃, Ne.symm hn₁₃, hn₂₃, Ne.symm hn₂₃]
    · have h₁ : t.card ≠ p - 1 := by intro h; apply hd; simpa [h, Nat.sub_add_cancel hpos] using (dvd_refl p)
      have h₂ : t.card ≠ 2 * p - 1 := by intro h; apply hd; rw [h, Nat.sub_add_cancel (by omega)]; exact dvd_mul_left p 2
      have h₃ : t.card ≠ 3 * p - 1 := by intro h; apply hd; rw [h, Nat.sub_add_cancel (by omega)]; exact dvd_mul_left p 3
      simp [hz, hcast, hd, h₁, h₂, h₃]
  · simp [hz]

lemma sum_powerset_restrict {R : Type*} [AddCommMonoid R] (s t : Finset α)
    (ht : t ⊆ s) (F : Finset α → R) :
    ∑ u ∈ t.powerset, F u = ∑ u ∈ s.powerset, if u ⊆ t then F u else 0 := by
  classical
  have heq : s.powerset.filter (· ⊆ t) = t.powerset := by
    ext u
    simp only [mem_filter, mem_powerset]
    exact and_iff_right_of_imp (fun h => h.trans ht)
  rw [← sum_filter, heq]

lemma count_lift (f : α → ZMod p × ZMod p) (s : Finset α) (m k : ℕ) (hkm : k ≤ m) :
    ∑ t ∈ s.powersetCard m, count f t k =
      ((s.card - k).choose (m - k) : ZMod p) * count f s k := by
  classical
  calc
    _ = ∑ t ∈ s.powersetCard m, ∑ u ∈ s.powerset,
        if u ⊆ t then (if u.card = k ∧ ∑ i ∈ u, f i = 0 then (1 : ZMod p) else 0) else 0 := by
      apply sum_congr rfl
      intro t ht
      exact sum_powerset_restrict s t (mem_powersetCard.mp ht).1 _
    _ = ∑ u ∈ s.powerset, ∑ t ∈ s.powersetCard m,
        if u ⊆ t then (if u.card = k ∧ ∑ i ∈ u, f i = 0 then 1 else 0) else 0 := sum_comm
    _ = ((s.card - k).choose (m - k) : ZMod p) * count f s k := by
      rw [count, mul_sum]
      apply sum_congr rfl
      intro u hu
      by_cases hc : u.card = k ∧ ∑ i ∈ u, f i = 0
      · simp only [ite_eq_left hc, mul_one]
        rw [sum_boole, card_filter_powersetCard_subset u s m (mem_powerset.mp hu) (by omega), hc.1]
      · simp [hc]

lemma choose_same_residue (a b d : ℕ) (hd : d < p) :
    ((a * p + d).choose (b * p + d) : ZMod p) = (a.choose b : ZMod p) := by
  have h := Choose.choose_modEq_choose_mod_mul_choose_div_nat
    (n := a * p + d) (k := b * p + d) (p := p)
  apply (ZMod.natCast_eq_natCast_iff _ _ _).mpr at h
  have ha : (a * p + d) / p = a := by
    rw [Nat.mul_comm a p, Nat.mul_add_div (Fact.out : p.Prime).pos]
    simp [Nat.div_eq_of_lt hd]
  have hb : (b * p + d) / p = b := by
    rw [Nat.mul_comm b p, Nat.mul_add_div (Fact.out : p.Prime).pos]
    simp [Nat.div_eq_of_lt hd]
  rw [ha, hb] at h
  simpa [Nat.add_mod, Nat.mod_eq_of_lt hd] using h

lemma count_complement (f : α → ZMod p × ZMod p) (s : Finset α) (k : ℕ)
    (hk : k ≤ s.card) (hs : ∑ i ∈ s, f i = 0) :
    count f s k = count f s (s.card - k) := by
  classical
  unfold count
  apply sum_bij (fun t _ => s \ t)
  · intro t ht
    exact mem_powerset.mpr sdiff_subset
  · intro t ht u hu heq
    have h := congrArg (fun v => s \ v) heq
    simpa only [Finset.sdiff_sdiff_eq_self (mem_powerset.mp ht),
      Finset.sdiff_sdiff_eq_self (mem_powerset.mp hu)] using h
  · intro t ht
    exact ⟨s \ t, mem_powerset.mpr sdiff_subset, Finset.sdiff_sdiff_eq_self (mem_powerset.mp ht)⟩
  · intro t ht
    have hts := mem_powerset.mp ht
    have hcard := card_le_card hts
    have hsum := sum_sdiff (f := f) hts
    rw [hs] at hsum
    have hsum' : (∑ i ∈ t, f i = 0) ↔ ∑ i ∈ s \ t, f i = 0 := by
      constructor <;> intro h
      · simpa [h] using hsum
      · simpa [h] using hsum
    have hc : t.card = k ↔ (s \ t).card = s.card - k := by
      rw [card_sdiff_of_subset hts]
      omega
    simp only [hc, hsum']

lemma sum_disjoint_to_supersets {R : Type*} [AddCommMonoid R] (s a : Finset α)
    (ha : a ⊆ s) (F : Finset α → R) :
    ∑ b ∈ (s \ a).powerset, F b =
      ∑ t ∈ s.powerset, if a ⊆ t then F (t \ a) else 0 := by
  classical
  rw [← sum_filter]
  have hinv : ∀ b ⊆ s \ a, (a ∪ b) \ a = b := by
    intro b hb
    exact union_sdiff_cancel_left (disjoint_sdiff_self_right.mono_right hb)
  apply sum_bij (fun b _ => a ∪ b)
  · intro b hb
    have hb' := mem_powerset.mp hb
    exact mem_filter.mpr ⟨mem_powerset.mpr (union_subset ha (hb'.trans sdiff_subset)), subset_union_left⟩
  · intro b hb c hc heq
    have h := congrArg (fun t => t \ a) heq
    simpa only [hinv b (mem_powerset.mp hb), hinv c (mem_powerset.mp hc)] using h
  · intro t ht
    have hts := mem_powerset.mp (mem_filter.mp ht).1
    have hat := (mem_filter.mp ht).2
    refine ⟨t \ a, mem_powerset.mpr ?_, ?_⟩
    · intro x hx
      exact mem_sdiff.mpr ⟨hts (mem_sdiff.mp hx).1, (mem_sdiff.mp hx).2⟩
    rw [union_comm, sdiff_union_of_subset hat]
  · intro b hb
    rw [hinv b (mem_powerset.mp hb)]

lemma count_extend (f : α → ZMod p × ZMod p) (s a : Finset α) (k l : ℕ)
    (ha : a ⊆ s) (hcard : a.card = k) (hsum : ∑ i ∈ a, f i = 0) :
    count f (s \ a) l = ∑ t ∈ s.powerset,
      if a ⊆ t ∧ t.card = k + l ∧ ∑ i ∈ t, f i = 0 then 1 else 0 := by
  classical
  rw [count, sum_disjoint_to_supersets s a ha]
  apply sum_congr rfl
  intro t ht
  by_cases hat : a ⊆ t
  · have hc := card_le_card hat
    have hdiff : ∑ i ∈ t \ a, f i = ∑ i ∈ t, f i := by
      simpa [hsum] using (sum_sdiff (f := f) hat)
    have heq : (t \ a).card = l ↔ t.card = k + l := by
      rw [card_sdiff_of_subset hat, hcard]
      omega
    simp only [hat, if_true, true_and, hdiff, heq]
  · simp [hat]

lemma partition_count (f : α → ZMod p × ZMod p) (s : Finset α) (k l : ℕ) :
    (∑ a ∈ s.powerset, if a.card = k ∧ ∑ i ∈ a, f i = 0
      then count f (s \ a) l else 0) =
    ∑ t ∈ s.powerset, if t.card = k + l ∧ ∑ i ∈ t, f i = 0
      then count f t k else 0 := by
  classical
  calc
    _ = ∑ a ∈ s.powerset, ∑ t ∈ s.powerset,
        if a.card = k ∧ ∑ i ∈ a, f i = 0 then
          (if a ⊆ t ∧ t.card = k + l ∧ ∑ i ∈ t, f i = 0 then (1 : ZMod p) else 0) else 0 := by
      apply sum_congr rfl
      intro a ha
      by_cases hc : a.card = k ∧ ∑ i ∈ a, f i = 0
      · simp only [hc, if_true]
        exact count_extend f s a k l (mem_powerset.mp ha) hc.1 hc.2
      · simp [hc]
    _ = ∑ t ∈ s.powerset, ∑ a ∈ s.powerset,
        if a.card = k ∧ ∑ i ∈ a, f i = 0 then
          (if a ⊆ t ∧ t.card = k + l ∧ ∑ i ∈ t, f i = 0 then (1 : ZMod p) else 0) else 0 := sum_comm
    _ = _ := by
      apply sum_congr rfl
      intro t ht
      rw [count, sum_powerset_restrict s t (mem_powerset.mp ht)]
      rw [ite_sum_zero]
      apply sum_congr rfl
      intro a ha
      by_cases h₁ : a.card = k ∧ ∑ i ∈ a, f i = 0 <;>
        by_cases h₂ : t.card = k + l ∧ ∑ i ∈ t, f i = 0 <;>
        by_cases h₃ : a ⊆ t <;> simp [h₁, h₂, h₃, and_assoc]

lemma count_exists (f : α → ZMod p × ZMod p) (s : Finset α) (k : ℕ)
    (h : count f s k ≠ 0) : ∃ t ⊆ s, t.card = k ∧ ∑ i ∈ t, f i = 0 := by
  classical
  by_contra hn
  apply h
  apply count_vanish
  intro t ht hc hz
  exact hn ⟨t, ht, hc, hz⟩

lemma small_congruence (f : α → ZMod p × ZMod p) (s : Finset α) (hp : Odd p)
    (hs₁ : 3 * p - 2 ≤ s.card) (hs₂ : s.card < 3 * p) :
    1 - count f s p + count f s (2 * p) = 0 := by
  have hpos := (Fact.out : p.Prime).two_le
  have h := alt_zero f s 0 (by omega)
  rw [alt_expand_zero f s hp (by omega), count_large f s (3 * p) hs₂] at h
  simpa using h

lemma three_p (f : α → ZMod p × ZMod p) (s : Finset α) (hp : Odd p)
    (hs : s.card = 3 * p) (hsum : ∑ i ∈ s, f i = 0) :
    ∃ t ⊆ s, t.card = p ∧ ∑ i ∈ t, f i = 0 := by
  classical
  by_contra hn
  have hpos := (Fact.out : p.Prime).two_le
  obtain ⟨u, hu, huc⟩ := exists_subset_card_eq (s := s) (show 3 * p - 1 ≤ s.card by omega)
  have hnp : count f u p = 0 := count_vanish f u p (by
    intro t ht hc hz; exact hn ⟨t, ht.trans hu, hc, hz⟩)
  have h := small_congruence f u hp (by omega) (by omega)
  have hne : count f u (2 * p) ≠ 0 := by
    intro he
    rw [hnp, he] at h
    norm_num at h
  obtain ⟨t, ht, htc, hts⟩ := count_exists f u (2 * p) hne
  have hts' := ht.trans hu
  apply hn
  refine ⟨s \ t, sdiff_subset, ?_, ?_⟩
  · rw [card_sdiff_of_subset hts', hs, htc]; omega
  · simpa [hts, hsum] using sum_sdiff (f := f) hts'

lemma lifted_congruence (f : α → ZMod p × ZMod p) (s : Finset α)
    (hp : Odd p) (hs : s.card = 4 * p - 3) (hp₃ : 3 ≤ p) :
    3 - 2 * count f s (p - 1) - 2 * count f s p +
      count f s (2 * p - 1) + count f s (2 * p) = 0 := by
  have hlocal : ∀ t ∈ s.powersetCard (3 * p - 3),
      1 - count f t (p - 1) - count f t p + count f t (2 * p - 1) + count f t (2 * p) = 0 := by
    intro t ht
    have hc := (mem_powersetCard.mp ht).2
    have h := alt_equal f t (by omega)
    rw [alt_expand_zero f t hp (by omega), alt_expand_one f t hp (by omega),
      count_large f t (3 * p) (by omega), count_large f t (3 * p - 1) (by omega)] at h
    linear_combination h
  have h := sum_eq_zero hlocal
  simp only [sum_add_distrib, sum_sub_distrib, sum_const, nsmul_eq_mul, mul_one,
    card_powersetCard] at h
  rw [count_lift f s (3 * p - 3) (p - 1) (by omega),
    count_lift f s (3 * p - 3) p (by omega),
    count_lift f s (3 * p - 3) (2 * p - 1) (by omega),
    count_lift f s (3 * p - 3) (2 * p) (by omega)] at h
  have c₀ : ((s.card).choose (3 * p - 3) : ZMod p) = 3 := by
    have h := choose_same_residue (p := p) 3 2 (p - 3) (by omega)
    norm_num at h
    convert h using 1 <;> congr 2 <;> omega
  have c₁ : ((s.card - (p - 1)).choose (3 * p - 3 - (p - 1)) : ZMod p) = 2 := by
    have h := choose_same_residue (p := p) 2 1 (p - 2) (by omega)
    norm_num at h
    convert h using 1 <;> congr 2 <;> omega
  have c₂ : ((s.card - p).choose (3 * p - 3 - p) : ZMod p) = 2 := by
    have h := choose_same_residue (p := p) 2 1 (p - 3) (by omega)
    norm_num at h
    convert h using 1 <;> congr 2 <;> omega
  have c₃ : ((s.card - (2 * p - 1)).choose (3 * p - 3 - (2 * p - 1)) : ZMod p) = 1 := by
    have h := choose_same_residue (p := p) 1 0 (p - 2) (by omega)
    norm_num at h
    convert h using 1 <;> congr 2 <;> omega
  have c₄ : ((s.card - 2 * p).choose (3 * p - 3 - 2 * p) : ZMod p) = 1 := by
    have h := choose_same_residue (p := p) 1 0 (p - 3) (by omega)
    norm_num at h
    convert h using 1 <;> congr 2 <;> omega
  simpa only [c₀, c₁, c₂, c₃, c₄, one_mul] using h

lemma boundary_counts (f : α → ZMod p × ZMod p) (s : Finset α)
    (hp : Odd p) (hs : s.card = 4 * p - 3)
    (hn : ∀ t ⊆ s, t.card = p → ∑ i ∈ t, f i ≠ 0) :
    count f s (p - 1) = count f s (3 * p - 1) := by
  have hpos := (Fact.out : p.Prime).two_le
  have hsmall : ∀ u ⊆ s, 3 * p - 2 ≤ u.card → u.card < 3 * p →
      count f u (2 * p) = -1 := by
    intro u hu hc₁ hc₂
    have h := small_congruence f u hp hc₁ hc₂
    rw [count_vanish f u p (fun t ht => hn t (ht.trans hu))] at h
    linear_combination h
  have hA : ∀ a ⊆ s, a.card = p - 1 → count f (s \ a) (2 * p) = -1 := by
    intro a ha hc
    apply hsmall _ sdiff_subset <;> rw [card_sdiff_of_subset ha, hs, hc] <;> omega
  have hD : ∀ t ⊆ s, t.card = 3 * p - 1 → (∑ i ∈ t, f i = 0) →
      count f t (p - 1) = -1 := by
    intro t ht hc hz
    have heq : t.card - (p - 1) = 2 * p := by omega
    rw [count_complement f t (p - 1) (by omega) hz, heq]
    exact hsmall t ht (by omega) (by omega)
  have h := partition_count f s (p - 1) (2 * p)
  rw [show p - 1 + 2 * p = 3 * p - 1 by omega] at h
  have hleft : (∑ a ∈ s.powerset, if a.card = p - 1 ∧ ∑ i ∈ a, f i = 0
      then count f (s \ a) (2 * p) else 0) = - count f s (p - 1) := by
    rw [count, ← sum_neg_distrib]
    apply sum_congr rfl
    intro a ha
    by_cases hc : a.card = p - 1 ∧ ∑ i ∈ a, f i = 0
    · rw [ite_eq_left hc, ite_eq_left hc, hA a (mem_powerset.mp ha) hc.1]
    · rw [ite_eq_right hc, ite_eq_right hc, neg_zero]
  have hright : (∑ t ∈ s.powerset, if t.card = 3 * p - 1 ∧ ∑ i ∈ t, f i = 0
      then count f t (p - 1) else 0) = - count f s (3 * p - 1) := by
    rw [count, ← sum_neg_distrib]
    apply sum_congr rfl
    intro t ht
    by_cases hc : t.card = 3 * p - 1 ∧ ∑ i ∈ t, f i = 0
    · rw [ite_eq_left hc, ite_eq_left hc, hD t (mem_powerset.mp ht) hc.1 hc.2]
    · rw [ite_eq_right hc, ite_eq_right hc, neg_zero]
  rw [hleft, hright] at h
  exact neg_injective h

theorem prime_case (f : α → ZMod p × ZMod p) (s : Finset α)
    (hs : s.card = 4 * p - 3) : ∃ t ⊆ s, t.card = p ∧ ∑ i ∈ t, f i = 0 := by
  classical
  by_cases hp₂ : p = 2
  · subst p
    have hni : ¬ Function.Injective (fun i : s => f i) := by
      intro hi
      have h := Fintype.card_le_of_injective _ hi
      have he : Fintype.card (ZMod 2 × ZMod 2) = 4 := by simp
      rw [he, Fintype.card_coe] at h
      omega
    obtain ⟨a, b, hab, hne⟩ := Function.not_injective_iff.mp hni
    have hab' : (a : α) ≠ (b : α) := fun he => hne (Subtype.ext he)
    refine ⟨{a.val, b.val}, ?_, by simp [hab'], ?_⟩
    · intro i hi
      simp only [mem_insert, mem_singleton] at hi
      rcases hi with rfl | rfl <;> exact Subtype.property _
    · rw [sum_pair hab', hab]
      exact CharTwo.add_self_eq_zero _
  · have hp := (Fact.out : p.Prime).odd_of_ne_two hp₂
    have hp₃ : 3 ≤ p := by have := (Fact.out : p.Prime).two_le; omega
    by_contra hnone
    have hn : ∀ t ⊆ s, t.card = p → ∑ i ∈ t, f i ≠ 0 := by
      intro t ht hc hz
      exact hnone ⟨t, ht, hc, hz⟩
    have hn₃ : count f s (3 * p) = 0 := by
      apply count_vanish
      intro t ht hc hz
      obtain ⟨u, hu, huc, huz⟩ := three_p f t hp hc hz
      exact hn u (hu.trans ht) huc huz
    have hn₁ : count f s p = 0 := count_vanish f s p hn
    have h₀ := alt_zero f s 0 (by omega)
    rw [alt_expand_zero f s hp (by omega), hn₁, hn₃] at h₀
    have h₁ := alt_zero f s 1 (by omega)
    rw [alt_expand_one f s hp (by omega)] at h₁
    have h₂ := lifted_congruence f s hp hs hp₃
    have h₃ := boundary_counts f s hp hs hn
    rw [hn₁] at h₂
    have htwo : (2 : ZMod p) = 0 := by linear_combination h₂ + h₁ - h₀ + h₃
    have hdiv : p ∣ 2 := (CharP.cast_eq_zero_iff (ZMod p) p 2).mp htwo
    have := Nat.le_of_dvd (by decide : 0 < 2) hdiv
    omega

end Prime

theorem integer_case (n : ℕ) (a b : α → ℤ) (s : Finset α)
    (hs : 4 * n - 3 ≤ s.card) :
    ∃ t ⊆ s, t.card = n ∧ (n : ℤ) ∣ ∑ i ∈ t, a i ∧ (n : ℤ) ∣ ∑ i ∈ t, b i := by
  classical
  induction n using Nat.prime_composite_induction generalizing α with
  | zero => exact ⟨∅, empty_subset _, by simp⟩
  | one =>
    obtain ⟨t, ht, hc⟩ := exists_subset_card_eq (s := s) (show 1 ≤ s.card by omega)
    exact ⟨t, ht, hc, by simp⟩
  | prime p hp =>
    haveI : Fact p.Prime := ⟨hp⟩
    obtain ⟨u, hu, huc⟩ := exists_subset_card_eq hs
    obtain ⟨t, ht, htc, htz⟩ := prime_case (fun i => ((a i : ZMod p), (b i : ZMod p))) u huc
    refine ⟨t, ht.trans hu, htc, ?_, ?_⟩
    · have h := congrArg Prod.fst htz
      simpa only [Prod.fst_sum, Prod.fst_zero, ← Int.cast_sum,
        ZMod.intCast_zmod_eq_zero_iff_dvd] using h
    · have h := congrArg Prod.snd htz
      simpa only [Prod.snd_sum, Prod.snd_zero, ← Int.cast_sum,
        ZMod.intCast_zmod_eq_zero_iff_dvd] using h
  | composite m hm ihm n hn ihn =>
    suffices ∀ k ≤ 4 * m - 3, ∃ S : Finset (Finset α), S.card = k ∧
        (S : Set (Finset α)).Pairwise _root_.Disjoint ∧
        ∀ t ∈ S, t ⊆ s ∧ t.card = n ∧ (n : ℤ) ∣ ∑ i ∈ t, a i ∧
          (n : ℤ) ∣ ∑ i ∈ t, b i by
      obtain ⟨S, hSc, hSd, hS⟩ := this _ le_rfl
      obtain ⟨T, hT, hTc, hTa, hTb⟩ := ihm
        (fun t => (∑ i ∈ t, a i) / n) (fun t => (∑ i ∈ t, b i) / n) S hSc.ge
      refine ⟨T.biUnion (fun x => x), biUnion_subset.mpr (fun t ht => (hS t (hT ht)).1), ?_, ?_, ?_⟩
      · rw [card_biUnion (hSd.mono hT), sum_const_nat (fun t ht => (hS t (hT ht)).2.1), hTc]
      · rw [sum_biUnion (hSd.mono hT), Int.natCast_mul, mul_comm,
          ← Int.dvd_div_iff_mul_dvd, Int.sum_div]
        · exact hTa
        · exact fun t ht => (hS t (hT ht)).2.2.1
        · exact dvd_sum (fun t ht => (hS t (hT ht)).2.2.1)
      · rw [sum_biUnion (hSd.mono hT), Int.natCast_mul, mul_comm,
          ← Int.dvd_div_iff_mul_dvd, Int.sum_div]
        · exact hTb
        · exact fun t ht => (hS t (hT ht)).2.2.2
        · exact dvd_sum (fun t ht => (hS t (hT ht)).2.2.2)
    intro k hk
    induction k with
    | zero => exact ⟨∅, by simp⟩
    | succ k ih =>
      obtain ⟨S, hSc, hSd, hS⟩ := ih (Nat.le_of_succ_le hk)
      have hremaining : 4 * n - 3 ≤ (s \ S.biUnion id).card := by
        calc
          _ ≤ (4 * m - k) * n - 3 := by gcongr; omega
          _ = (4 * (m * n) - 3) - ∑ t ∈ S, t.card := by
            rw [tsub_mul, mul_assoc, tsub_right_comm,
              sum_const_nat (fun t ht => (hS t ht).2.1), hSc]
          _ ≤ s.card - (S.biUnion id).card := by
            gcongr
            exact card_biUnion_le
          _ ≤ (s \ S.biUnion id).card := le_card_sdiff ..
      obtain ⟨t, ht, htc, hta, htb⟩ := ihn a b (s \ S.biUnion id) hremaining
      have htS : t ∉ S := by
        intro h
        have hd : Disjoint t t := sdiff_disjoint.mono ht (subset_biUnion_of_mem id h)
        have hc : t.card = 0 := card_eq_zero.mpr (disjoint_self.mp hd)
        omega
      refine ⟨S.cons t htS, by rw [card_cons, hSc], ?_, ?_⟩
      · simp only [cons_eq_insert, coe_insert, Set.pairwise_insert_of_symm, mem_coe, ne_eq]
        exact ⟨hSd, fun u hu _ => sdiff_disjoint.mono ht (subset_biUnion_of_mem id hu)⟩
      · simp only [cons_eq_insert, mem_insert, forall_eq_or_imp, and_assoc]
        exact ⟨ht.trans sdiff_subset, htc, hta, htb, hS⟩

end Kemnitz

theorem problem8 (n : ℕ) (hn : 1 ≤ n)
    (f : Fin (4 * n - 3) → ZMod n × ZMod n) :
    ∃ s : Finset (Fin (4 * n - 3)),
      s.card = n ∧ ∑ i ∈ s, f i = 0 := by
  classical
  haveI : NeZero n := ⟨by omega⟩
  obtain ⟨s, hs, hc, ha, hb⟩ := Kemnitz.integer_case n
    (fun i => ((f i).1.val : ℤ)) (fun i => ((f i).2.val : ℤ)) univ (by simp)
  refine ⟨s, hc, ?_⟩
  apply Prod.ext
  · have h := (ZMod.intCast_zmod_eq_zero_iff_dvd (∑ i ∈ s, ((f i).1.val : ℤ)) n).mpr ha
    simpa only [Int.cast_sum, Int.cast_natCast, ZMod.natCast_zmod_val, Prod.fst_sum,
      Prod.fst_zero] using h
  · have h := (ZMod.intCast_zmod_eq_zero_iff_dvd (∑ i ∈ s, ((f i).2.val : ℤ)) n).mpr hb
    simpa only [Int.cast_sum, Int.cast_natCast, ZMod.natCast_zmod_val, Prod.snd_sum,
      Prod.snd_zero] using h

#print axioms problem
