import Mathlib.Analysis.MeanInequalities
import Mathlib.Data.Finset.Powerset
import Mathlib.Algebra.Order.Ring.Pow
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity

private lemma one_add_inv_pow_mono (n : ℕ) (hn : 1 ≤ n) :
    ((n + 1 : ℚ) / n) ^ n ≤ ((n + 2 : ℚ) / (n + 1)) ^ (n + 1) := by
  have hn0 : (n : ℚ) ≠ 0 := by positivity
  have hn1 : (n + 1 : ℚ) ≠ 0 := by positivity
  have hbern : 1 - (n : ℚ) / (n + 1 : ℚ) ^ 2 ≤ (1 - 1 / (n + 1 : ℚ) ^ 2) ^ n := by
    have ha : (-2 : ℚ) ≤ -(1 / (n + 1 : ℚ) ^ 2) := by
      have hsq : (1 : ℚ) ≤ (n + 1 : ℚ) ^ 2 := by
        have : (1 : ℚ) ≤ n + 1 := by exact_mod_cast (by omega : 1 ≤ n + 1)
        nlinarith
      have hle1 : 1 / (n + 1 : ℚ) ^ 2 ≤ 1 := div_le_one_of_le₀ hsq (by positivity)
      linarith
    have hb := one_add_mul_le_pow ha n
    calc 1 - (n : ℚ) / (n + 1 : ℚ) ^ 2
        = 1 + (n : ℚ) * (-(1 / (n + 1 : ℚ) ^ 2)) := by ring
      _ ≤ (1 + -(1 / (n + 1 : ℚ) ^ 2)) ^ n := hb
      _ = (1 - 1 / (n + 1 : ℚ) ^ 2) ^ n := by ring_nf
  have h1 : (1 : ℚ) ≤ ((n + 2 : ℚ) / (n + 1)) * (1 - (n : ℚ) / (n + 1 : ℚ) ^ 2) := by
    have hpos : (0 : ℚ) < (n + 1 : ℚ) ^ 3 := by positivity
    have hid : ((n + 2 : ℚ) / (n + 1)) * (1 - (n : ℚ) / (n + 1 : ℚ) ^ 2) =
        ((n + 2 : ℚ) * ((n + 1 : ℚ) ^ 2 - n)) / (n + 1 : ℚ) ^ 3 := by
      field_simp
    rw [hid, le_div_iff₀ hpos, one_mul]
    nlinarith
  have h2 : (1 : ℚ) ≤ ((n + 2 : ℚ) / (n + 1)) * (1 - 1 / (n + 1 : ℚ) ^ 2) ^ n :=
    h1.trans (mul_le_mul_of_nonneg_left hbern (by positivity))
  have hmul := mul_le_mul_of_nonneg_left h2 (by positivity : (0 : ℚ) ≤ ((n + 1 : ℚ) / n) ^ n)
  rw [mul_one] at hmul
  have heq : ((n + 1 : ℚ) / n) ^ n * (((n + 2 : ℚ) / (n + 1)) * (1 - 1 / (n + 1 : ℚ) ^ 2) ^ n) =
      ((n + 2 : ℚ) / (n + 1)) ^ (n + 1) := by
    have hstep : ((n + 1 : ℚ) / n) * (1 - 1 / (n + 1 : ℚ) ^ 2) = (n + 2 : ℚ) / (n + 1) := by
      field_simp
      ring
    calc ((n + 1 : ℚ) / n) ^ n * (((n + 2 : ℚ) / (n + 1)) * (1 - 1 / (n + 1 : ℚ) ^ 2) ^ n)
        = ((n + 2 : ℚ) / (n + 1)) * (((n + 1 : ℚ) / n) * (1 - 1 / (n + 1 : ℚ) ^ 2)) ^ n := by
          rw [mul_pow]; ring
      _ = ((n + 2 : ℚ) / (n + 1)) * ((n + 2 : ℚ) / (n + 1)) ^ n := by rw [hstep]
      _ = ((n + 2 : ℚ) / (n + 1)) ^ (n + 1) := (pow_succ' _ n).symm
  rwa [heq] at hmul

private lemma succ_pow_div_mono {m n : ℕ} (hm : 1 ≤ m) (hmn : m ≤ n) :
    ((m + 1 : ℚ) ^ (m + 1)) / (m : ℚ) ^ m ≤ ((n + 1 : ℚ) ^ (n + 1)) / (n : ℚ) ^ n := by
  induction n, hmn using Nat.le_induction with
  | base => rfl
  | succ k hk ih =>
    refine ih.trans ?_
    have hk1 : 1 ≤ k := hm.trans hk
    have hk0 : (k : ℚ) ≠ 0 := by positivity
    have hk10 : (k + 1 : ℚ) ≠ 0 := by positivity
    have hbase := one_add_inv_pow_mono k hk1
    have h1 : ((k + 1 : ℚ) ^ (k + 1)) / (k : ℚ) ^ k = (k + 1 : ℚ) * ((k + 1 : ℚ) / k) ^ k := by
      rw [div_pow, pow_succ']; ring
    have h2 : ((k + 2 : ℚ) ^ (k + 2)) / (k + 1 : ℚ) ^ (k + 1) =
        (k + 2 : ℚ) * ((k + 2 : ℚ) / (k + 1)) ^ (k + 1) := by
      rw [div_pow, pow_succ']; ring
    have hcast : ((↑(k + 1) + 1 : ℚ) ^ (k + 1 + 1)) / (↑(k + 1) : ℚ) ^ (k + 1) =
        ((k + 2 : ℚ) ^ (k + 2)) / (k + 1 : ℚ) ^ (k + 1) := by
      push_cast; ring_nf
    rw [hcast, h1, h2]
    have hle : (k + 1 : ℚ) ≤ k + 2 := by linarith
    exact mul_le_mul hle hbase (by positivity) (by positivity)

private lemma nat_four_mul_pow_le {a b : ℕ} (ha : 1 ≤ a) (hab : a ≤ b) :
    (4 * a) ^ a * b ^ b ≤ (a + b) ^ (a + b) := by
  induction b, hab using Nat.le_induction with
  | base =>
    exact le_of_eq <| calc (4 * a) ^ a * a ^ a
        = (4 * a * a) ^ a := by rw [← mul_pow]
      _ = ((2 * a) ^ 2) ^ a := by congr 1; ring
      _ = (2 * a) ^ (2 * a) := by rw [← pow_mul]
      _ = (a + a) ^ (a + a) := by rw [two_mul]
  | succ k hk ih =>
    have hk1 : 1 ≤ k := ha.trans hk
    have hmono : ((k + 1 : ℚ) ^ (k + 1)) / (k : ℚ) ^ k ≤
        ((a + k + 1 : ℚ) ^ (a + k + 1)) / (a + k : ℚ) ^ (a + k) := by
      have hm := succ_pow_div_mono hk1 (Nat.le_add_left k a)
      push_cast at hm ⊢
      simpa only [add_assoc] using hm
    have hq : ((4 * a : ℚ) ^ a) * ((k + 1 : ℚ) ^ (k + 1)) ≤
        ((a + k + 1 : ℚ) ^ (a + k + 1)) := by
      have ihq : (4 * a : ℚ) ^ a * (k : ℚ) ^ k ≤ (a + k : ℚ) ^ (a + k) := by exact_mod_cast ih
      have hkp : (0 : ℚ) < (k : ℚ) ^ k := by positivity
      have hakp : (0 : ℚ) < (a + k : ℚ) ^ (a + k) := by positivity
      have hstep := mul_le_mul ihq hmono (by positivity) (by positivity)
      have hlhs : ((4 * a : ℚ) ^ a * (k : ℚ) ^ k) * (((k + 1 : ℚ) ^ (k + 1)) / (k : ℚ) ^ k) =
          (4 * a : ℚ) ^ a * (k + 1 : ℚ) ^ (k + 1) := by
        field_simp
      have hrhs : (a + k : ℚ) ^ (a + k) * (((a + k + 1 : ℚ) ^ (a + k + 1)) / (a + k : ℚ) ^ (a + k)) =
          (a + k + 1 : ℚ) ^ (a + k + 1) := by
        field_simp
      rw [hlhs, hrhs] at hstep
      exact hstep
    have hq' : (((4 * a) ^ a * (k + 1) ^ (k + 1) : ℕ) : ℚ) ≤
        (((a + (k + 1)) ^ (a + (k + 1)) : ℕ) : ℚ) := by
      push_cast
      simpa only [add_assoc] using hq
    exact_mod_cast hq'

private lemma nat_pow_mul_pow_four_le {a b : ℕ} (ha : 1 ≤ a) (hb : 1 ≤ b) :
    a ^ a * b ^ b * 4 ^ min a b ≤ (a + b) ^ (a + b) := by
  rcases le_total a b with hab | hba
  · rw [min_eq_left hab]
    calc a ^ a * b ^ b * 4 ^ a
        = (4 * a) ^ a * b ^ b := by rw [mul_pow]; ring
      _ ≤ (a + b) ^ (a + b) := nat_four_mul_pow_le ha hab
  · rw [min_eq_right hba]
    calc a ^ a * b ^ b * 4 ^ b
        = (4 * b) ^ b * a ^ a := by rw [mul_pow]; ring
      _ ≤ (b + a) ^ (b + a) := nat_four_mul_pow_le hb hba
      _ = (a + b) ^ (a + b) := by rw [add_comm]

private lemma am_gm_two_pow {ι : Type*} [DecidableEq ι] (s : Finset ι) (hs : s.Nonempty)
    (d : ι → ℕ) (M : ℕ) (hsum : ∑ i ∈ s, 2 ^ (d i) ≤ 2 ^ M) :
    s.card ^ s.card * 2 ^ (∑ i ∈ s, d i) ≤ 2 ^ (M * s.card) := by
  let n : ℕ := s.card
  have hn_pos : 0 < n := hs.card_pos
  have hn_r : (0 : ℝ) < n := by exact_mod_cast hn_pos
  have hsum_r : ∑ i ∈ s, (2 : ℝ) ^ (d i) ≤ (2 : ℝ) ^ M := by exact_mod_cast hsum
  have hw : ∀ i ∈ s, (0 : ℝ) ≤ 1 / (n : ℝ) := fun _ _ => by positivity
  have hws : ∑ _i ∈ s, (1 : ℝ) / n = 1 := by
    simp [n, ne_of_gt hn_r]
  have hz : ∀ i ∈ s, (0 : ℝ) ≤ (2 : ℝ) ^ (d i) := fun _ _ => by positivity
  have ham := Real.geom_mean_le_arith_mean_weighted s (fun _ => 1 / (n : ℝ))
    (fun i => (2 : ℝ) ^ (d i)) hw hws hz
  have hpow_am := pow_le_pow_left₀
    (Finset.prod_nonneg fun i _ => Real.rpow_nonneg (by positivity) _) ham n
  have hlhs : (∏ i ∈ s, ((2 : ℝ) ^ (d i)) ^ ((1 : ℝ) / n)) ^ n =
      (2 : ℝ) ^ (∑ i ∈ s, d i) := by
    rw [← Finset.prod_pow]
    have hprod_eq : ∏ i ∈ s, (((2 : ℝ) ^ (d i)) ^ ((1 : ℝ) / n)) ^ n =
        ∏ i ∈ s, (2 : ℝ) ^ (d i) := by
      refine Finset.prod_congr rfl fun i _ => ?_
      rw [← Real.rpow_natCast, ← Real.rpow_mul (by positivity)]
      simp [ne_of_gt hn_r]
    rw [hprod_eq]
    have hpow_prod : ∀ t : Finset ι, ∏ i ∈ t, (2 : ℝ) ^ (d i) = (2 : ℝ) ^ (∑ i ∈ t, d i) := by
      intro t
      induction t using Finset.induction_on with
      | empty => simp
      | insert a t ha ih_t => simp [Finset.prod_insert ha, Finset.sum_insert ha, pow_add, ih_t]
    exact hpow_prod s
  have hrhs : (∑ i ∈ s, (1 : ℝ) / n * (2 : ℝ) ^ (d i)) ^ n ≤
      ((2 : ℝ) ^ M / n) ^ n := by
    have h1 : ∑ i ∈ s, (1 : ℝ) / n * (2 : ℝ) ^ (d i) =
        (∑ i ∈ s, (2 : ℝ) ^ (d i)) / n := by
      rw [← Finset.mul_sum]; ring
    rw [h1]
    exact pow_le_pow_left₀ (by positivity) (div_le_div_of_nonneg_right hsum_r hn_r.le) n
  have hineq : (2 : ℝ) ^ (∑ i ∈ s, d i) ≤ (2 : ℝ) ^ (M * n) / (n : ℝ) ^ n := by
    calc (2 : ℝ) ^ (∑ i ∈ s, d i)
        = (∏ i ∈ s, ((2 : ℝ) ^ (d i)) ^ ((1 : ℝ) / n)) ^ n := hlhs.symm
      _ ≤ (∑ i ∈ s, (1 : ℝ) / n * (2 : ℝ) ^ (d i)) ^ n := hpow_am
      _ ≤ ((2 : ℝ) ^ M / n) ^ n := hrhs
      _ = (2 : ℝ) ^ (M * n) / (n : ℝ) ^ n := by rw [div_pow, ← pow_mul]
  have hr_final : (n : ℝ) ^ n * (2 : ℝ) ^ (∑ i ∈ s, d i) ≤ (2 : ℝ) ^ (M * n) := by
    rw [mul_comm]
    exact (le_div_iff₀ (by positivity)).mp hineq
  exact_mod_cast hr_final

private def cl {α : Type*} [DecidableEq α]
    (U : Finset α) (G : Finset (Finset α)) (s : Finset α) : Finset α :=
  U.filter fun x => ∀ h ∈ G, s ⊆ h → x ∈ h

private lemma mem_cl {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {s : Finset α} {x : α} :
    x ∈ cl U G s ↔ x ∈ U ∧ ∀ h ∈ G, s ⊆ h → x ∈ h := by
  simp [cl]

private lemma subset_cl {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {s : Finset α}
    (hsub : ∀ h ∈ G, h ⊆ U) (hex : ∃ g ∈ G, s ⊆ g) :
    s ⊆ cl U G s := by
  rcases hex with ⟨g, hg, hsg⟩
  intro x hx
  exact mem_cl.mpr ⟨hsub g hg (hsg hx), fun h _ hsh => hsh hx⟩

private lemma cl_subset_of_mem {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {s h : Finset α}
    (hh : h ∈ G) (hsh : s ⊆ h) :
    cl U G s ⊆ h := by
  intro x hx
  exact (mem_cl.mp hx).2 h hh hsh

private lemma finset_inter_closure_mem {α : Type*} [DecidableEq α]
    (G C : Finset (Finset α)) (hC_ne : C.Nonempty)
    (hC_sub : ∀ h ∈ C, h ∈ G)
    (hinter : ∀ g₁ ∈ G, ∀ g₂ ∈ G, g₁ ∩ g₂ ∈ G) :
    ∃ m ∈ G, ∀ x, x ∈ m ↔ ∀ h ∈ C, x ∈ h := by
  induction C using Finset.induction_on with
  | empty => simp at hC_ne
  | insert a C' ha ih =>
    by_cases hC' : C'.Nonempty
    · obtain ⟨m', hm'G, hm'⟩ := ih hC' (fun h hh => hC_sub h (Finset.mem_insert_of_mem hh))
      have haG : a ∈ G := hC_sub a (Finset.mem_insert_self a C')
      refine ⟨a ∩ m', hinter a haG m' hm'G, fun x => ?_⟩
      rw [Finset.mem_inter, hm']
      constructor
      · rintro ⟨hxa, hxm'⟩ h hh
        rcases Finset.mem_insert.mp hh with rfl | hh'
        · exact hxa
        · exact hxm' h hh'
      · intro hall
        exact ⟨hall a (Finset.mem_insert_self a C'),
          fun h hh' => hall h (Finset.mem_insert_of_mem hh')⟩
    · rw [Finset.not_nonempty_iff_eq_empty] at hC'
      subst hC'
      exact ⟨a, hC_sub a (Finset.mem_insert_self a ∅), fun x => by simp⟩

private lemma cl_mem {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {s : Finset α}
    (hinter : ∀ g₁ ∈ G, ∀ g₂ ∈ G, g₁ ∩ g₂ ∈ G)
    (hsub : ∀ g ∈ G, g ⊆ U) (hex : ∃ g ∈ G, s ⊆ g) :
    cl U G s ∈ G := by
  let C : Finset (Finset α) := G.filter (fun h => s ⊆ h)
  have hC_ne : C.Nonempty := by
    rcases hex with ⟨g, hg, hsg⟩
    exact ⟨g, Finset.mem_filter.mpr ⟨hg, hsg⟩⟩
  have hC_sub : ∀ h ∈ C, h ∈ G := fun h hh => (Finset.mem_filter.mp hh).1
  obtain ⟨m, hmG, hm⟩ := finset_inter_closure_mem G C hC_ne hC_sub hinter
  have heq : m = cl U G s := by
    ext x
    rw [hm, mem_cl]
    constructor
    · intro h
      have hxU : x ∈ U := hsub m hmG ((hm x).mpr h)
      refine ⟨hxU, fun g hg hsg => h g (Finset.mem_filter.mpr ⟨hg, hsg⟩)⟩
    · rintro ⟨_, h⟩ g hg
      have hg' := Finset.mem_filter.mp hg
      exact h g hg'.1 hg'.2
  rwa [← heq]

private lemma cl_eq_self {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {g : Finset α}
    (hg : g ∈ G) (hsub : g ⊆ U) :
    cl U G g = g := by
  ext x
  rw [mem_cl]
  constructor
  · rintro ⟨_, h⟩
    exact h g hg Finset.Subset.rfl
  · intro hxg
    exact ⟨hsub hxg, fun h _ hgh => hgh hxg⟩

private lemma cl_mono {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {s t : Finset α}
    (hst : s ⊆ t) :
    cl U G s ⊆ cl U G t := by
  intro x hx
  rcases mem_cl.mp hx with ⟨hxU, hxG⟩
  exact mem_cl.mpr ⟨hxU, fun h hh hth => hxG h hh (hst.trans hth)⟩

private noncomputable def genCard {α : Type*} [DecidableEq α]
    (U : Finset α) (G : Finset (Finset α)) (g : Finset α) : ℕ :=
  sInf { n : ℕ | ∃ b ⊆ g, cl U G b = g ∧ b.card = n }

private lemma exists_minGen {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {g : Finset α}
    (hg : g ∈ G) (hsub : g ⊆ U) :
    ∃ b ⊆ g, cl U G b = g ∧ b.card = genCard U G g := by
  have hne : { n : ℕ | ∃ b ⊆ g, cl U G b = g ∧ b.card = n }.Nonempty :=
    ⟨g.card, g, Finset.Subset.rfl, cl_eq_self hg hsub, rfl⟩
  exact Nat.sInf_mem hne

private lemma genCard_le {α : Type*} [DecidableEq α]
    {U : Finset α} {G : Finset (Finset α)} {g b : Finset α}
    (hbg : b ⊆ g) (hcl : cl U G b = g) :
    genCard U G g ≤ b.card :=
  Nat.sInf_le ⟨b, hbg, hcl, rfl⟩

private lemma two_pow_two_mul_sum_genCard_le {α : Type*} [DecidableEq α] :
    ∀ (n : ℕ) (U : Finset α), U.card = n →
    ∀ (G : Finset (Finset α)), G.Nonempty →
    (∀ g ∈ G, g ⊆ U) →
    (∀ g₁ ∈ G, ∀ g₂ ∈ G, g₁ ∩ g₂ ∈ G) →
    2 ^ (2 * ∑ g ∈ G, genCard U G g) ≤ G.card ^ G.card := by
  intro n
  induction n with
  | zero =>
    intro U hU G hG hsub _
    rw [Finset.card_eq_zero] at hU
    subst hU
    have hG1 : G = {∅} := by
      rcases hG with ⟨g₀, hg₀⟩
      ext g
      constructor
      · intro hg
        rw [Finset.mem_singleton]
        exact Finset.subset_empty.mp (hsub g hg)
      · intro hg
        rw [Finset.mem_singleton.mp hg]
        rwa [← Finset.subset_empty.mp (hsub g₀ hg₀)]
    subst hG1
    have hgen0 : genCard (∅ : Finset α) {(∅ : Finset α)} (∅ : Finset α) = 0 := by
      have hle : genCard (∅ : Finset α) {(∅ : Finset α)} (∅ : Finset α) ≤ (∅ : Finset α).card :=
        genCard_le Finset.Subset.rfl (cl_eq_self (Finset.mem_singleton_self (∅ : Finset α)) Finset.Subset.rfl)
      simpa using hle
    simp [hgen0]
  | succ n ih =>
    intro U hU G hG hsub hinter
    have hU_ne : U.Nonempty := Finset.card_pos.mp (by omega)
    obtain ⟨x, hxU⟩ := hU_ne
    let U' := U.erase x
    have hU' : U'.card = n := by
      rw [Finset.card_erase_of_mem hxU, hU]
      omega
    let G0 := G.filter (fun g => x ∉ g)
    let G1_raw := G.filter (fun g => x ∈ g)
    let G1 := G1_raw.image (fun g : Finset α => g.erase x)
    have hinj_erase : Set.InjOn (fun g : Finset α => g.erase x) G1_raw := by
      intro g₁ hg₁ g₂ hg₂ heq
      have hx₁ : x ∈ g₁ := (Finset.mem_filter.mp hg₁).2
      have hx₂ : x ∈ g₂ := (Finset.mem_filter.mp hg₂).2
      have h1 : insert x (g₁.erase x) = g₁ := Finset.insert_erase hx₁
      have h2 : insert x (g₂.erase x) = g₂ := Finset.insert_erase hx₂
      dsimp only at heq
      rw [← h1, ← h2, heq]
    have hG1_card : G1.card = G1_raw.card := Finset.card_image_of_injOn hinj_erase
    have hG_card : G.card = G0.card + G1.card := by
      rw [hG1_card]
      exact (Finset.card_filter_add_card_filter_not (s := G) (p := fun g => x ∈ g)).symm.trans
        (add_comm _ _)
    have hG1_sub : ∀ g' ∈ G1, g' ⊆ U' := by
      intro g' hg'
      rw [Finset.mem_image] at hg'
      rcases hg' with ⟨g, hg, rfl⟩
      exact Finset.erase_subset_erase x (hsub g (Finset.mem_filter.mp hg).1)
    have hG1_inter : ∀ g₁ ∈ G1, ∀ g₂ ∈ G1, g₁ ∩ g₂ ∈ G1 := by
      intro g₁ hg₁ g₂ hg₂
      rw [Finset.mem_image] at hg₁ hg₂ ⊢
      rcases hg₁ with ⟨a₁, ha₁, rfl⟩
      rcases hg₂ with ⟨a₂, ha₂, rfl⟩
      have ha₁' := Finset.mem_filter.mp ha₁
      have ha₂' := Finset.mem_filter.mp ha₂
      refine ⟨a₁ ∩ a₂, Finset.mem_filter.mpr
        ⟨hinter a₁ ha₁'.1 a₂ ha₂'.1, Finset.mem_inter.mpr ⟨ha₁'.2, ha₂'.2⟩⟩, ?_⟩
      ext y
      simp only [Finset.mem_inter, Finset.mem_erase]
      tauto
    by_cases hG0_ne : G0.Nonempty
    · have hG0_sub : ∀ g ∈ G0, g ⊆ U' := by
        intro g hg
        have hg' := Finset.mem_filter.mp hg
        intro y hy
        exact Finset.mem_erase.mpr ⟨fun hyx => hg'.2 (hyx ▸ hy), hsub g hg'.1 hy⟩
      have hG0_inter : ∀ g₁ ∈ G0, ∀ g₂ ∈ G0, g₁ ∩ g₂ ∈ G0 := by
        intro g₁ hg₁ g₂ hg₂
        have hg₁' := Finset.mem_filter.mp hg₁
        have hg₂' := Finset.mem_filter.mp hg₂
        exact Finset.mem_filter.mpr
          ⟨hinter g₁ hg₁'.1 g₂ hg₂'.1, fun hx => hg₁'.2 (Finset.mem_inter.mp hx).1⟩
      by_cases hG1_ne : G1.Nonempty
      · have hih0 := ih U' hU' G0 hG0_ne hG0_sub hG0_inter
        have hih1 := ih U' hU' G1 hG1_ne hG1_sub hG1_inter
        have hsum_split : ∑ g ∈ G, genCard U G g =
            (∑ g ∈ G0, genCard U G g) + ∑ g ∈ G1_raw, genCard U G g := by
          rw [add_comm]
          exact (Finset.sum_filter_add_sum_filter_not G (fun g => x ∈ g) (genCard U G)).symm
        have hsum0_le : ∑ g ∈ G0, genCard U G g ≤ ∑ g ∈ G0, genCard U' G0 g := by
          refine Finset.sum_le_sum fun g hg => ?_
          have hg' := Finset.mem_filter.mp hg
          obtain ⟨b, hbg, hcl0, hcard⟩ := exists_minGen hg (hG0_sub g hg)
          have hclG : cl U G b = g := by
            apply Finset.Subset.antisymm
            · exact cl_subset_of_mem hg'.1 hbg
            · rw [← hcl0]
              intro y hy
              rcases mem_cl.mp hy with ⟨hyU', hyG0⟩
              refine mem_cl.mpr ⟨Finset.erase_subset x U hyU', fun h hh hbh => ?_⟩
              have hhg0 : h ∩ g ∈ G0 := Finset.mem_filter.mpr
                ⟨hinter h hh g hg'.1, fun hxin => hg'.2 (Finset.mem_inter.mp hxin).2⟩
              have hbhg : b ⊆ h ∩ g := Finset.subset_inter hbh hbg
              exact (Finset.mem_inter.mp (hyG0 (h ∩ g) hhg0 hbhg)).1
          rw [← hcard]
          exact genCard_le hbg hclG
        have hsum1_eq : ∑ g ∈ G1_raw, genCard U G g =
            ∑ g' ∈ G1, genCard U G (insert x g') := by
          change ∑ g ∈ G1_raw, genCard U G g =
            ∑ g' ∈ G1_raw.image (fun g => g.erase x), genCard U G (insert x g')
          rw [Finset.sum_image (f := fun g' => genCard U G (insert x g')) hinj_erase]
          refine Finset.sum_congr rfl fun g hg => ?_
          rw [Finset.insert_erase (Finset.mem_filter.mp hg).2]
        have h_cl_insert : ∀ g' ∈ G1, ∀ b ⊆ g', cl U' G1 b = g' →
            cl U G (insert x b) = insert x g' := by
          intro g' hg' b hbg' hcl1
          rw [Finset.mem_image] at hg'
          rcases hg' with ⟨g, hg, rfl⟩
          have hgF := Finset.mem_filter.mp hg
          have hxg_ins : insert x (g.erase x) = g := Finset.insert_erase hgF.2
          rw [hxg_ins]
          apply Finset.Subset.antisymm
          · exact cl_subset_of_mem hgF.1 (hxg_ins ▸ Finset.insert_subset_insert x hbg')
          · intro y hy
            refine mem_cl.mpr ⟨hsub g hgF.1 hy, fun h hh hbh => ?_⟩
            have hxh : x ∈ h := hbh (Finset.mem_insert_self x b)
            have hh1 : h.erase x ∈ G1 := Finset.mem_image.mpr
              ⟨h, Finset.mem_filter.mpr ⟨hh, hxh⟩, rfl⟩
            have hb_he : b ⊆ h.erase x := by
              intro z hz
              have hzg : z ∈ g.erase x := hbg' hz
              exact Finset.mem_erase.mpr
                ⟨(Finset.mem_erase.mp hzg).1, hbh (Finset.mem_insert_of_mem hz)⟩
            by_cases hyx : y = x
            · rwa [hyx]
            · have hy_ge : y ∈ g.erase x := Finset.mem_erase.mpr ⟨hyx, hy⟩
              rw [← hcl1] at hy_ge
              have hy_he := (mem_cl.mp hy_ge).2 (h.erase x) hh1 hb_he
              exact Finset.erase_subset x h hy_he
        let bad := G1.filter (fun g' => genCard U' G1 g' < genCard U G (insert x g'))
        have hsum1_le : ∑ g' ∈ G1, genCard U G (insert x g') ≤
            (∑ g' ∈ G1, genCard U' G1 g') + bad.card := by
          have hpt : ∀ g' ∈ G1, genCard U G (insert x g') ≤
              genCard U' G1 g' + (if g' ∈ bad then 1 else 0) := by
            intro g' hg'
            by_cases hbad : g' ∈ bad
            · simp only [hbad, ↓reduceIte]
              obtain ⟨b, hbg', hcl1, hcard⟩ := exists_minGen hg' (hG1_sub g' hg')
              have hclG := h_cl_insert g' hg' b hbg' hcl1
              have hle := genCard_le (Finset.insert_subset_insert x hbg') hclG
              have hcard_ins : (insert x b).card ≤ b.card + 1 := Finset.card_insert_le x b
              omega
            · simp only [hbad, ↓reduceIte, add_zero]
              have : ¬ (genCard U' G1 g' < genCard U G (insert x g')) := by
                intro hlt
                exact hbad (Finset.mem_filter.mpr ⟨hg', hlt⟩)
              omega
          calc ∑ g' ∈ G1, genCard U G (insert x g')
              ≤ ∑ g' ∈ G1, (genCard U' G1 g' + if g' ∈ bad then 1 else 0) :=
                Finset.sum_le_sum hpt
            _ = (∑ g' ∈ G1, genCard U' G1 g') + ∑ g' ∈ G1, (if g' ∈ bad then 1 else 0) :=
                Finset.sum_add_distrib
            _ = (∑ g' ∈ G1, genCard U' G1 g') + bad.card := by
                congr 1
                rw [← Finset.sum_filter, Finset.sum_const, smul_eq_mul, mul_one]
                congr 1
                ext y
                simp [bad]
        have hbad_le_G1 : bad.card ≤ G1.card := Finset.card_le_card (Finset.filter_subset _ _)
        have hbad_le_G0 : bad.card ≤ G0.card := by
          choose wit hwit using fun (g' : Finset α) (hg' : g' ∈ G1) =>
            exists_minGen hg' (hG1_sub g' hg')
          let φ : Finset α → Finset α := fun g' =>
            if hg' : g' ∈ G1 then cl U G (wit g' hg') else ∅
          refine Finset.card_le_card_of_injOn φ (fun g' hg' => ?_) (fun g₁ hg₁ g₂ hg₂ heq => ?_)
          · have hg'b := Finset.mem_filter.mp hg'
            have hg'1 := hg'b.1
            have hlt := hg'b.2
            simp only [φ]
            split_ifs
            rcases Finset.mem_image.mp hg'1 with ⟨g, hg, hge⟩
            have hgF := Finset.mem_filter.mp hg
            have hg_ins : insert x g' = g := by rw [← hge, Finset.insert_erase hgF.2]
            have hsub_wit : wit g' hg'1 ⊆ g := by
              rw [← hg_ins]
              exact (hwit g' hg'1).1.trans (Finset.subset_insert x g')
            have hmemG : cl U G (wit g' hg'1) ∈ G :=
              cl_mem hinter hsub ⟨g, hgF.1, hsub_wit⟩
            have hnx : x ∉ cl U G (wit g' hg'1) := by
              intro hxin
              have hins_sub : insert x (wit g' hg'1) ⊆ cl U G (wit g' hg'1) :=
                Finset.insert_subset_iff.mpr ⟨hxin, subset_cl hsub ⟨g, hgF.1, hsub_wit⟩⟩
              have h1 : cl U G (insert x (wit g' hg'1)) ⊆ cl U G (wit g' hg'1) := by
                intro y hy
                rcases mem_cl.mp hy with ⟨hyU, hyG⟩
                exact hyG (cl U G (wit g' hg'1)) hmemG hins_sub
              have h2 : cl U G (insert x (wit g' hg'1)) = insert x g' :=
                h_cl_insert g' hg'1 (wit g' hg'1) (hwit g' hg'1).1 (hwit g' hg'1).2.1
              have h3 : cl U G (wit g' hg'1) ⊆ insert x g' :=
                hg_ins ▸ cl_subset_of_mem hgF.1 hsub_wit
              have heq_ins : cl U G (wit g' hg'1) = insert x g' := by
                apply Finset.Subset.antisymm h3
                rw [← h2]
                exact h1
              have hle := genCard_le ((hwit g' hg'1).1.trans (Finset.subset_insert x g')) heq_ins
              have hcard := (hwit g' hg'1).2.2
              omega
            exact Finset.mem_filter.mpr ⟨hmemG, hnx⟩
          · have hg₁b := Finset.mem_filter.mp hg₁
            have hg₂b := Finset.mem_filter.mp hg₂
            have hg₁1 := hg₁b.1
            have hg₂1 := hg₂b.1
            simp only [φ] at heq
            split_ifs at heq
            have hrec : ∀ g' (hg' : g' ∈ G1),
                cl U G (insert x (cl U G (wit g' hg'))) = insert x g' := by
              intro g' hg'
              rcases Finset.mem_image.mp hg' with ⟨g, hg, hge⟩
              have hgF := Finset.mem_filter.mp hg
              have hg_ins : insert x g' = g := by rw [← hge, Finset.insert_erase hgF.2]
              have hsub_wit : wit g' hg' ⊆ g := by
                rw [← hg_ins]
                exact (hwit g' hg').1.trans (Finset.subset_insert x g')
              have hsub_cl : cl U G (wit g' hg') ⊆ g := cl_subset_of_mem hgF.1 hsub_wit
              have h1 : insert x (wit g' hg') ⊆ insert x (cl U G (wit g' hg')) :=
                Finset.insert_subset_insert x (subset_cl hsub ⟨g, hgF.1, hsub_wit⟩)
              have h2 : insert x (cl U G (wit g' hg')) ⊆ g :=
                Finset.insert_subset_iff.mpr ⟨hgF.2, hsub_cl⟩
              have h_ins_cl : cl U G (insert x (wit g' hg')) = insert x g' :=
                h_cl_insert g' hg' (wit g' hg') (hwit g' hg').1 (hwit g' hg').2.1
              apply Finset.Subset.antisymm
              · rw [hg_ins]
                exact cl_subset_of_mem hgF.1 h2
              · rw [← h_ins_cl]
                exact cl_mono h1
            have heq_ins : insert x g₁ = insert x g₂ := by
              rw [← hrec g₁ hg₁1, ← hrec g₂ hg₂1, heq]
            have hx1 : x ∉ g₁ := by
              rcases Finset.mem_image.mp hg₁1 with ⟨g, _, hge⟩
              rw [← hge]; exact Finset.notMem_erase x g
            have hx2 : x ∉ g₂ := by
              rcases Finset.mem_image.mp hg₂1 with ⟨g, _, hge⟩
              rw [← hge]; exact Finset.notMem_erase x g
            have := congrArg (fun s => s.erase x) heq_ins
            simpa [Finset.erase_insert hx1, Finset.erase_insert hx2] using this
        have hbad_min : bad.card ≤ min G0.card G1.card := le_min hbad_le_G0 hbad_le_G1
        have htot_le : ∑ g ∈ G, genCard U G g ≤
            (∑ g ∈ G0, genCard U' G0 g) + (∑ g' ∈ G1, genCard U' G1 g') + min G0.card G1.card := by
          rw [hsum_split, hsum1_eq]
          omega
        calc 2 ^ (2 * ∑ g ∈ G, genCard U G g)
            ≤ 2 ^ (2 * ((∑ g ∈ G0, genCard U' G0 g) +
                (∑ g' ∈ G1, genCard U' G1 g') + min G0.card G1.card)) :=
              Nat.pow_le_pow_right (by norm_num) (by omega)
          _ = 2 ^ (2 * ∑ g ∈ G0, genCard U' G0 g) *
                2 ^ (2 * ∑ g' ∈ G1, genCard U' G1 g') * 4 ^ min G0.card G1.card := by
              rw [mul_add, mul_add, pow_add, pow_add]
              congr 1
              rw [show (4 : ℕ) = 2 ^ 2 by norm_num, ← pow_mul]
          _ ≤ G0.card ^ G0.card * G1.card ^ G1.card * 4 ^ min G0.card G1.card := by
              gcongr
          _ ≤ (G0.card + G1.card) ^ (G0.card + G1.card) :=
              nat_pow_mul_pow_four_le hG0_ne.card_pos hG1_ne.card_pos
          _ = G.card ^ G.card := by rw [← hG_card]
      · rw [Finset.not_nonempty_iff_eq_empty] at hG1_ne
        have hG1_raw_empty : G1_raw = ∅ := by
          rw [← Finset.card_eq_zero, ← hG1_card, hG1_ne, Finset.card_empty]
        have hG0_eq : G0 = G := by
          ext g
          simp only [G0, Finset.mem_filter, and_iff_left_iff_imp]
          intro hg hx
          have hmem : g ∈ G1_raw := Finset.mem_filter.mpr ⟨hg, hx⟩
          rw [hG1_raw_empty] at hmem
          exact Finset.notMem_empty g hmem
        have hsub' : ∀ g ∈ G, g ⊆ U' := by
          intro g hg
          rw [← hG0_eq] at hg
          intro y hy
          exact Finset.mem_erase.mpr ⟨fun hyx => (Finset.mem_filter.mp hg).2 (hyx ▸ hy), hsub g (Finset.mem_filter.mp hg).1 hy⟩
        have hih := ih U' hU' G hG hsub' hinter
        have hsum_le : ∑ g ∈ G, genCard U G g ≤ ∑ g ∈ G, genCard U' G g := by
          refine Finset.sum_le_sum fun g hg => ?_
          obtain ⟨b, hbg, hcl', hcard⟩ := exists_minGen hg (hsub' g hg)
          have hclG : cl U G b = g := by
            rw [← hcl']
            ext y
            simp only [mem_cl]
            constructor
            · rintro ⟨_, hyG⟩
              exact ⟨hsub' g hg (hyG g hg hbg), hyG⟩
            · rintro ⟨hyU', hyG⟩
              exact ⟨Finset.erase_subset x U hyU', hyG⟩
          rw [← hcard]
          exact genCard_le hbg hclG
        calc 2 ^ (2 * ∑ g ∈ G, genCard U G g)
            ≤ 2 ^ (2 * ∑ g ∈ G, genCard U' G g) := Nat.pow_le_pow_right (by norm_num) (by omega)
          _ ≤ G.card ^ G.card := hih
    · rw [Finset.not_nonempty_iff_eq_empty] at hG0_ne
      have hG1_raw_eq : G1_raw = G := by
        ext g
        simp only [G1_raw, Finset.mem_filter, and_iff_left_iff_imp]
        intro hg
        by_contra hnx
        have hmem : g ∈ G0 := Finset.mem_filter.mpr ⟨hg, hnx⟩
        rw [hG0_ne] at hmem
        exact Finset.notMem_empty g hmem
      have hG1_ne : G1.Nonempty := by
        rcases hG with ⟨g₀, hg₀⟩
        exact ⟨g₀.erase x, Finset.mem_image.mpr ⟨g₀, hG1_raw_eq ▸ hg₀, rfl⟩⟩
      have hG_eq_card : G1.card = G.card := by
        rw [hG1_card, hG1_raw_eq]
      have hih := ih U' hU' G1 hG1_ne hG1_sub hG1_inter
      have hsum_le : ∑ g ∈ G, genCard U G g ≤ ∑ g' ∈ G1, genCard U' G1 g' := by
        have hinj' : Set.InjOn (fun g : Finset α => g.erase x) G := by
          rwa [← hG1_raw_eq]
        change ∑ g ∈ G, genCard U G g ≤ ∑ g' ∈ G1_raw.image (fun g => g.erase x), genCard U' G1 g'
        rw [hG1_raw_eq, Finset.sum_image hinj']
        refine Finset.sum_le_sum fun g hg => ?_
        have hmem1 : g.erase x ∈ G1 := Finset.mem_image.mpr ⟨g, hG1_raw_eq ▸ hg, rfl⟩
        obtain ⟨b, hbg, hcl1, hcard⟩ := exists_minGen hmem1 (hG1_sub (g.erase x) hmem1)
        have hxg : x ∈ g := by
          have hg_raw : g ∈ G1_raw := by rwa [hG1_raw_eq]
          exact (Finset.mem_filter.mp hg_raw).2
        have hxb : x ∉ b := fun hxin => Finset.notMem_erase x g (hbg hxin)
        have hclG : cl U G b = g := by
          apply Finset.Subset.antisymm
          · exact cl_subset_of_mem hg (hbg.trans (Finset.erase_subset x g))
          · intro y hy
            refine mem_cl.mpr ⟨hsub g hg hy, fun h hh hbh => ?_⟩
            have hxh : x ∈ h := by
              have hh_raw : h ∈ G1_raw := by rwa [hG1_raw_eq]
              exact (Finset.mem_filter.mp hh_raw).2
            by_cases hyx : y = x
            · rwa [hyx]
            · have hh1 : h.erase x ∈ G1 := Finset.mem_image.mpr ⟨h, hG1_raw_eq ▸ hh, rfl⟩
              have hbh1 : b ⊆ h.erase x := fun z hz =>
                Finset.mem_erase.mpr ⟨fun hzx => hxb (hzx ▸ hz), hbh hz⟩
              have hy_ge : y ∈ g.erase x := Finset.mem_erase.mpr ⟨hyx, hy⟩
              rw [← hcl1] at hy_ge
              exact Finset.erase_subset x h ((mem_cl.mp hy_ge).2 (h.erase x) hh1 hbh1)
        rw [← hcard]
        exact genCard_le (hbg.trans (Finset.erase_subset x g)) hclG
      calc 2 ^ (2 * ∑ g ∈ G, genCard U G g)
          ≤ 2 ^ (2 * ∑ g' ∈ G1, genCard U' G1 g') := Nat.pow_le_pow_right (by norm_num) (by omega)
        _ ≤ G1.card ^ G1.card := hih
        _ = G.card ^ G.card := by rw [hG_eq_card]

private lemma card_interval_eq_pow {α : Type*} [DecidableEq α]
    {U B G : Finset α} (hBG : B ⊆ G) (hGU : G ⊆ U) :
    (U.powerset.filter (fun x => B ⊆ x ∧ x ⊆ G)).card = 2 ^ (G.card - B.card) := by
  symm
  rw [← Finset.card_sdiff_of_subset hBG, ← Finset.card_powerset]
  refine Finset.card_bij (fun s _ => B ∪ s) (fun s hs => ?_) (fun s₁ hs₁ s₂ hs₂ heq => ?_)
    (fun x hx => ?_)
  · rw [Finset.mem_powerset] at hs
    rw [Finset.mem_filter, Finset.mem_powerset]
    have hsu : B ∪ s ⊆ G := Finset.union_subset hBG (hs.trans Finset.sdiff_subset)
    exact ⟨hsu.trans hGU, Finset.subset_union_left, hsu⟩
  · rw [Finset.mem_powerset] at hs₁ hs₂
    have h1 : (B ∪ s₁) \ B = s₁ := by
      ext y
      simp only [Finset.mem_sdiff, Finset.mem_union]
      constructor
      · rintro ⟨hyB | hys, hnyB⟩
        · exact absurd hyB hnyB
        · exact hys
      · intro hy
        exact ⟨Or.inr hy, (Finset.mem_sdiff.mp (hs₁ hy)).2⟩
    have h2 : (B ∪ s₂) \ B = s₂ := by
      ext y
      simp only [Finset.mem_sdiff, Finset.mem_union]
      constructor
      · rintro ⟨hyB | hys, hnyB⟩
        · exact absurd hyB hnyB
        · exact hys
      · intro hy
        exact ⟨Or.inr hy, (Finset.mem_sdiff.mp (hs₂ hy)).2⟩
    rw [← h1, ← h2, heq]
  · rw [Finset.mem_filter] at hx
    refine ⟨x \ B, Finset.mem_powerset.mpr (Finset.sdiff_subset_sdiff hx.2.2 Finset.Subset.rfl), ?_⟩
    exact Finset.union_sdiff_of_subset hx.2.1

private lemma problem4_of_empty_mem {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (h0 : ∅ ∈ A)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  let U : Finset α := A.biUnion id
  have ha_sub : ∀ a ∈ A, a ⊆ U := fun a ha => Finset.subset_biUnion_of_mem id ha
  let G : Finset (Finset α) := A.image (fun a => U \ a)
  have hinj : Set.InjOn (fun a => U \ a) A := by
    intro a₁ ha₁ a₂ ha₂ heq
    have h1 : U \ (U \ a₁) = a₁ := Finset.sdiff_sdiff_eq_self (ha_sub a₁ ha₁)
    have h2 : U \ (U \ a₂) = a₂ := Finset.sdiff_sdiff_eq_self (ha_sub a₂ ha₂)
    dsimp only at heq
    rw [← h1, ← h2, heq]
  have hG_card : G.card = A.card := Finset.card_image_of_injOn hinj
  have hG_ne : G.Nonempty := ⟨U \ ∅, Finset.mem_image.mpr ⟨∅, h0, rfl⟩⟩
  have hG_sub : ∀ g ∈ G, g ⊆ U := by
    intro g hg
    rcases Finset.mem_image.mp hg with ⟨a, _, rfl⟩
    exact Finset.sdiff_subset
  have hG_inter : ∀ g₁ ∈ G, ∀ g₂ ∈ G, g₁ ∩ g₂ ∈ G := by
    intro g₁ hg₁ g₂ hg₂
    rcases Finset.mem_image.mp hg₁ with ⟨a₁, ha₁, rfl⟩
    rcases Finset.mem_image.mp hg₂ with ⟨a₂, ha₂, rfl⟩
    refine Finset.mem_image.mpr ⟨a₁ ∪ a₂, hunion a₁ ha₁ a₂ ha₂, ?_⟩
    ext x
    simp only [Finset.mem_inter, Finset.mem_sdiff, Finset.mem_union]
    tauto
  have hsum_comp : ∑ a ∈ A, a.card + ∑ g ∈ G, g.card = U.card * G.card := by
    have hsum_G : ∑ g ∈ G, g.card = ∑ a ∈ A, (U \ a).card := Finset.sum_image hinj
    rw [hsum_G, hG_card, ← Finset.sum_add_distrib]
    have hpt : ∀ a ∈ A, a.card + (U \ a).card = U.card := by
      intro a ha
      rw [add_comm]
      exact Finset.card_sdiff_add_card_eq_card (ha_sub a ha)
    rw [Finset.sum_congr rfl hpt, Finset.sum_const, smul_eq_mul, mul_comm]
  choose B hB using fun (g : Finset α) (hg : g ∈ G) => exists_minGen hg (hG_sub g hg)
  let I : Finset α → Finset (Finset α) := fun g =>
    if hg : g ∈ G then U.powerset.filter (fun x => B g hg ⊆ x ∧ x ⊆ g) else ∅
  have hI_disj : Set.PairwiseDisjoint (G : Set (Finset α)) I := by
    intro g₁ hg₁ g₂ hg₂ hne
    change Disjoint (I g₁) (I g₂)
    rw [Finset.disjoint_left]
    intro x hx₁ hx₂
    change g₁ ∈ G at hg₁
    change g₂ ∈ G at hg₂
    simp only [I] at hx₁ hx₂
    split_ifs at hx₁ hx₂
    rw [Finset.mem_filter] at hx₁ hx₂
    have hcl_eq : ∀ g (hg : g ∈ G), B g hg ⊆ x → x ⊆ g → cl U G x = g := by
      intro g hg hBx hxg
      apply Finset.Subset.antisymm
      · exact cl_subset_of_mem hg hxg
      · rw [← (hB g hg).2.1]
        exact cl_mono hBx
    exact hne ((hcl_eq g₁ hg₁ hx₁.2.1 hx₁.2.2).symm.trans (hcl_eq g₂ hg₂ hx₂.2.1 hx₂.2.2))
  have hI_sub : G.biUnion I ⊆ U.powerset := by
    intro x hx
    rw [Finset.mem_biUnion] at hx
    rcases hx with ⟨g, hg, hxg⟩
    simp only [I] at hxg
    split_ifs at hxg
    rw [Finset.mem_filter] at hxg
    exact hxg.1
  have hsum_I : ∑ g ∈ G, (I g).card ≤ 2 ^ U.card := by
    calc ∑ g ∈ G, (I g).card
        = (G.biUnion I).card := (Finset.card_biUnion hI_disj).symm
      _ ≤ U.powerset.card := Finset.card_le_card hI_sub
      _ = 2 ^ U.card := Finset.card_powerset U
  have hI_card : ∀ g ∈ G, (I g).card = 2 ^ (g.card - genCard U G g) := by
    intro g hg
    simp only [I]
    split_ifs
    rw [card_interval_eq_pow (hB g hg).1 (hG_sub g hg), (hB g hg).2.2]
  have hsum_pow : ∑ g ∈ G, 2 ^ (g.card - genCard U G g) ≤ 2 ^ U.card := by
    rwa [← Finset.sum_congr rfl hI_card]
  have ham := am_gm_two_pow G hG_ne (fun g => g.card - genCard U G g) U.card hsum_pow
  have hineq2 := two_pow_two_mul_sum_genCard_le U.card U rfl G hG_ne hG_sub hG_inter
  have hgen_le_g : ∀ g ∈ G, genCard U G g ≤ g.card := fun g hg => by
    rw [← (hB g hg).2.2]
    exact Finset.card_le_card (hB g hg).1
  let S_diff := ∑ g ∈ G, (g.card - genCard U G g)
  let S_gen := ∑ g ∈ G, genCard U G g
  let S_A := ∑ a ∈ A, a.card
  have hS_sum : S_diff + S_gen + S_A = U.card * G.card := by
    have hsg : S_diff + S_gen = ∑ g ∈ G, g.card := by
      rw [← Finset.sum_add_distrib]
      refine Finset.sum_congr rfl fun g hg => ?_
      exact Nat.sub_add_cancel (hgen_le_g g hg)
    omega
  have h1 : G.card ^ G.card ≤ 2 ^ (S_gen + S_A) := by
    have hmul : 2 ^ S_diff * G.card ^ G.card ≤ 2 ^ S_diff * 2 ^ (S_gen + S_A) := by
      rw [← pow_add, show S_diff + (S_gen + S_A) = U.card * G.card by omega]
      simpa [mul_comm] using ham
    exact Nat.le_of_mul_le_mul_left hmul (by positivity)
  have hsq : G.card ^ G.card * G.card ^ G.card ≤ G.card ^ G.card * 2 ^ (2 * S_A) := by
    calc G.card ^ G.card * G.card ^ G.card
        ≤ 2 ^ (S_gen + S_A) * 2 ^ (S_gen + S_A) := Nat.mul_le_mul h1 h1
      _ = 2 ^ (2 * S_gen) * 2 ^ (2 * S_A) := by
          rw [← pow_add, ← pow_add]
          congr 1; ring
      _ ≤ G.card ^ G.card * 2 ^ (2 * S_A) := Nat.mul_le_mul_right _ hineq2
  have hpos : 0 < G.card ^ G.card := Nat.pow_pos hG_ne.card_pos
  have hfinal := Nat.le_of_mul_le_mul_left hsq hpos
  rwa [hG_card] at hfinal

theorem problem4 {α : Type*} [DecidableEq α]
    (A : Finset (Finset α)) (hA : A.Nonempty)
    (hunion : ∀ a ∈ A, ∀ b ∈ A, a ∪ b ∈ A) :
    A.card ^ A.card ≤ 2 ^ (2 * ∑ a ∈ A, a.card) := by
  by_cases h0 : ∅ ∈ A
  · exact problem4_of_empty_mem A h0 hunion
  · let A' := insert ∅ A
    have h0' : ∅ ∈ A' := Finset.mem_insert_self ∅ A
    have hunion' : ∀ a ∈ A', ∀ b ∈ A', a ∪ b ∈ A' := by
      intro a ha b hb
      rcases Finset.mem_insert.mp ha with rfl | haA <;>
        rcases Finset.mem_insert.mp hb with rfl | hbA
      · exact h0'
      · rw [Finset.empty_union]; exact Finset.mem_insert_of_mem hbA
      · rw [Finset.union_empty]; exact Finset.mem_insert_of_mem haA
      · exact Finset.mem_insert_of_mem (hunion a haA b hbA)
    have hres := problem4_of_empty_mem A' h0' hunion'
    have hsum : ∑ a ∈ A', a.card = ∑ a ∈ A, a.card := by
      simp [A', Finset.sum_insert h0]
    have hcard : A.card ≤ A'.card := Finset.card_le_card (Finset.subset_insert ∅ A)
    have hpow : A.card ^ A.card ≤ A'.card ^ A'.card :=
      (Nat.pow_le_pow_left hcard A.card).trans
        (Nat.pow_le_pow_right (hA.card_pos.trans_le hcard) hcard)
    rw [hsum] at hres
    exact hpow.trans hres
