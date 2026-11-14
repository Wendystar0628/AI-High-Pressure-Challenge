import Mathlib.Analysis.Calculus.ContDiff.Deriv
import Mathlib.Analysis.Calculus.Deriv.Add
import Mathlib.Analysis.Calculus.Deriv.Mul
import Mathlib.Analysis.Calculus.LocalExtr.Basic
import Mathlib.MeasureTheory.Integral.IntervalIntegral.FundThmCalculus

section Problem1Aux

open Set intervalIntegral

private lemma problem1_alg (a b c M I₁ I₂ I : ℝ)
    (hac : a < c) (hcb : c < b) (hM : 0 < M)
    (h1 : M < (c - a) * M * I₁) (h2 : M ≤ (b - c) * M * I₂)
    (hadd : I₁ + I₂ = I) :
    4 < (b - a) * I := by
  have hca : 0 < c - a := sub_pos.mpr hac
  have hbc : 0 < b - c := sub_pos.mpr hcb
  have hba : 0 < b - a := by linarith
  have hcI1 : 1 < (c - a) * I₁ := by
    have : M * 1 < M * ((c - a) * I₁) := by linarith
    exact lt_of_mul_lt_mul_left this hM.le
  have hcI2 : 1 ≤ (b - c) * I₂ := by
    have : M * 1 ≤ M * ((b - c) * I₂) := by linarith
    exact le_of_mul_le_mul_left this hM
  have hI1_pos : 0 < I₁ := by
    by_contra! hle
    have : (c - a) * I₁ ≤ 0 := mul_nonpos_of_nonneg_of_nonpos hca.le hle
    linarith
  have hI2_nonneg : 0 ≤ I₂ := by
    by_contra! hlt
    have : (b - c) * I₂ < 0 := mul_neg_of_pos_of_neg hbc hlt
    linarith
  have hI_pos : 0 < I := by linarith
  have p1 : b - c < (b - c) * ((c - a) * I₁) := by
    simpa using mul_lt_mul_of_pos_left hcI1 hbc
  have p2 : c - a ≤ (c - a) * ((b - c) * I₂) := by
    simpa using mul_le_mul_of_nonneg_left hcI2 hca.le
  have hsum : b - a < (c - a) * (b - c) * I := by
    calc b - a = (b - c) + (c - a) := by ring
      _ < (b - c) * ((c - a) * I₁) + (c - a) * ((b - c) * I₂) := add_lt_add_of_lt_of_le p1 p2
      _ = (c - a) * (b - c) * (I₁ + I₂) := by ring
      _ = (c - a) * (b - c) * I := by rw [hadd]
  have hamgm : 4 * ((c - a) * (b - c)) ≤ (b - a) ^ 2 := by
    have hsq : 0 ≤ (2 * c - a - b) ^ 2 := sq_nonneg _
    linarith [show (b - a) ^ 2 - 4 * ((c - a) * (b - c)) = (2 * c - a - b) ^ 2 by ring]
  have h4 : (b - a) * 4 < (b - a) * ((b - a) * I) := by
    calc (b - a) * 4 = 4 * (b - a) := by ring
      _ < 4 * ((c - a) * (b - c) * I) := mul_lt_mul_of_pos_left hsum (by norm_num)
      _ = (4 * ((c - a) * (b - c))) * I := by ring
      _ ≤ (b - a) ^ 2 * I := mul_le_mul_of_nonneg_right hamgm hI_pos.le
      _ = (b - a) * ((b - a) * I) := by ring
  exact lt_of_mul_lt_mul_left h4 hba.le

private lemma problem1_aux (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  have hu_step1 : Differentiable ℝ u ∧ ContDiff ℝ 1 (deriv u) := by
    rw [show (2 : WithTop ℕ∞) = 1 + 1 from rfl, contDiff_succ_iff_deriv] at hu
    exact ⟨hu.1, hu.2.2⟩
  have hu_diff : Differentiable ℝ u := hu_step1.1
  have hu'_step : Differentiable ℝ (deriv u) ∧ Continuous (deriv (deriv u)) :=
    contDiff_one_iff_deriv.mp hu_step1.2
  have hu'_diff : Differentiable ℝ (deriv u) := hu'_step.1
  have hu''_cont : Continuous (deriv (deriv u)) := hu'_step.2
  have hu_cont : Continuous u := hu_diff.continuous
  obtain ⟨c, hc_mem, hc_max⟩ := isCompact_Icc.exists_isMaxOn (nonempty_Icc.mpr hab.le)
    (continuous_abs.comp hu_cont).continuousOn
  let M := |u c|
  obtain ⟨x₀, hx₀_mem, hx₀_ne⟩ := hne
  have hM_pos : 0 < M := lt_of_lt_of_le (abs_pos.mpr hx₀_ne) (hc_max (Ioo_subset_Icc_self hx₀_mem))
  have huc_ne : u c ≠ 0 := abs_pos.mp hM_pos
  have hac : a < c := lt_of_le_of_ne hc_mem.1 (by intro h; subst h; exact huc_ne ha)
  have hcb : c < b := lt_of_le_of_ne hc_mem.2 (by intro h; subst h; exact huc_ne hb)
  have hnhds : Icc a b ∈ nhds c := Icc_mem_nhds hac hcb
  have hderiv_c : deriv u c = 0 := by
    rcases le_or_gt 0 (u c) with huc_nonneg | huc_neg
    · have hmax : IsMaxOn u (Icc a b) c := by
        intro x hx
        show u x ≤ u c
        have h1 : |u x| ≤ |u c| := hc_max hx
        rw [abs_of_nonneg huc_nonneg] at h1
        exact le_trans (le_abs_self _) h1
      exact (hmax.isLocalMax hnhds).deriv_eq_zero
    · have hmin : IsMinOn u (Icc a b) c := by
        intro x hx
        show u c ≤ u x
        have h1 : |u x| ≤ |u c| := hc_max hx
        rw [abs_of_neg huc_neg] at h1
        linarith [neg_abs_le (u x)]
      exact (hmin.isLocalMin hnhds).deriv_eq_zero
  have hftc1 : ∫ t in a..c, (t - a) * deriv (deriv u) t = -u c := by
    let F₁ : ℝ → ℝ := fun t => (t - a) * deriv u t - u t
    have hF₁ : ∀ x ∈ uIcc a c, HasDerivAt F₁ ((x - a) * deriv (deriv u) x) x := by
      intro x _
      have hd1 : HasDerivAt (fun t => t - a) 1 x := (hasDerivAt_id x).sub_const a
      have hd2 : HasDerivAt (deriv u) (deriv (deriv u) x) x := (hu'_diff x).hasDerivAt
      have hd3 : HasDerivAt u (deriv u x) x := (hu_diff x).hasDerivAt
      convert (hd1.mul hd2).sub hd3 using 1
      ring
    have hint1 : IntervalIntegrable (fun t => (t - a) * deriv (deriv u) t) MeasureTheory.volume a c :=
      ((continuous_id.sub continuous_const).mul hu''_cont).intervalIntegrable a c
    rw [integral_eq_sub_of_hasDerivAt hF₁ hint1]
    simp [F₁, hderiv_c, ha]
  have hcongr1 : ∫ t in a..c, (t - a) * deriv (deriv u) t =
      ∫ t in a..c, -((t - a) * (q t * u t)) := by
    apply integral_congr
    intro t ht
    dsimp only
    rw [uIcc_of_le hac.le] at ht
    rcases eq_or_lt_of_le ht.1 with rfl | hlt
    · simp
    · have ht_Ioo : t ∈ Ioo a b := ⟨hlt, lt_of_le_of_lt ht.2 hcb⟩
      have h := hode t ht_Ioo
      have hdd : deriv (deriv u) t = -(q t * u t) := by linarith
      rw [hdd]
      ring
  have huc_eq1 : u c = ∫ t in a..c, (t - a) * (q t * u t) := by
    have h : -u c = -(∫ t in a..c, (t - a) * (q t * u t)) := by
      rw [← hftc1, hcongr1, integral_neg]
    linarith
  have hftc2 : ∫ t in c..b, (b - t) * deriv (deriv u) t = -u c := by
    let F₂ : ℝ → ℝ := fun t => (b - t) * deriv u t + u t
    have hF₂ : ∀ x ∈ uIcc c b, HasDerivAt F₂ ((b - x) * deriv (deriv u) x) x := by
      intro x _
      have hd1 : HasDerivAt (fun t => b - t) (-1) x := by
        convert (hasDerivAt_id x).const_sub b using 1
        rfl
      have hd2 : HasDerivAt (deriv u) (deriv (deriv u) x) x := (hu'_diff x).hasDerivAt
      have hd3 : HasDerivAt u (deriv u x) x := (hu_diff x).hasDerivAt
      convert (hd1.mul hd2).add hd3 using 1
      ring
    have hint2 : IntervalIntegrable (fun t => (b - t) * deriv (deriv u) t) MeasureTheory.volume c b :=
      ((continuous_const.sub continuous_id).mul hu''_cont).intervalIntegrable c b
    rw [integral_eq_sub_of_hasDerivAt hF₂ hint2]
    simp [F₂, hderiv_c, hb]
  have hcongr2 : ∫ t in c..b, (b - t) * deriv (deriv u) t =
      ∫ t in c..b, -((b - t) * (q t * u t)) := by
    apply integral_congr
    intro t ht
    dsimp only
    rw [uIcc_of_le hcb.le] at ht
    rcases eq_or_lt_of_le ht.2 with hgt | hlt
    · subst hgt; simp
    · have ht_Ioo : t ∈ Ioo a b := ⟨lt_of_lt_of_le hac ht.1, hlt⟩
      have h := hode t ht_Ioo
      have hdd : deriv (deriv u) t = -(q t * u t) := by linarith
      rw [hdd]
      ring
  have huc_eq2 : u c = ∫ t in c..b, (b - t) * (q t * u t) := by
    have h : -u c = -(∫ t in c..b, (b - t) * (q t * u t)) := by
      rw [← hftc2, hcongr2, integral_neg]
    linarith
  have hq_ac : ContinuousOn q (Icc a c) := hq.mono (Icc_subset_Icc_right hcb.le)
  have hq_cb : ContinuousOn q (Icc c b) := hq.mono (Icc_subset_Icc_left hac.le)
  let f₁ : ℝ → ℝ := fun t => |(t - a) * (q t * u t)|
  let g₁ : ℝ → ℝ := fun t => (c - a) * M * |q t|
  have hf₁_cont : ContinuousOn f₁ (Icc a c) :=
    continuous_abs.comp_continuousOn <|
      (continuousOn_id.sub continuousOn_const).mul (hq_ac.mul hu_cont.continuousOn)
  have hg₁_cont : ContinuousOn g₁ (Icc a c) :=
    continuousOn_const.mul (continuous_abs.comp_continuousOn hq_ac)
  have hM_le_f₁ : M ≤ ∫ t in a..c, f₁ t := by
    calc M = |∫ t in a..c, (t - a) * (q t * u t)| := by rw [← huc_eq1]
      _ ≤ ∫ t in a..c, f₁ t := abs_integral_le_integral_abs hac.le
  have hf₁_le_g₁ : ∀ t ∈ Icc a c, f₁ t ≤ g₁ t := by
    intro t ht
    have hta : 0 ≤ t - a := sub_nonneg.mpr ht.1
    have hut : |u t| ≤ M := hc_max ⟨ht.1, le_trans ht.2 hcb.le⟩
    dsimp [f₁, g₁]
    rw [abs_mul, abs_mul, abs_of_nonneg hta]
    have h1 : (t - a) * |u t| ≤ (c - a) * M :=
      mul_le_mul (sub_le_sub_right ht.2 a) hut (abs_nonneg _) (sub_nonneg.mpr hac.le)
    calc (t - a) * (|q t| * |u t|) = ((t - a) * |u t|) * |q t| := by ring
      _ ≤ ((c - a) * M) * |q t| := mul_le_mul_of_nonneg_right h1 (abs_nonneg _)
  have hex_lt : ∃ t ∈ Icc a c, f₁ t < g₁ t := by
    by_contra! h_ge
    have hq_zero_Ico : ∀ t ∈ Ico a c, q t = 0 := by
      intro t ht
      by_contra hqt
      have hqpos : 0 < |q t| := abs_pos.mpr hqt
      have hta : 0 ≤ t - a := sub_nonneg.mpr ht.1
      have hut : |u t| ≤ M := hc_max ⟨ht.1, le_trans ht.2.le hcb.le⟩
      have h1 : (t - a) * |u t| < (c - a) * M := by
        calc (t - a) * |u t| ≤ (t - a) * M := mul_le_mul_of_nonneg_left hut hta
          _ < (c - a) * M := mul_lt_mul_of_pos_right (sub_lt_sub_right ht.2 a) hM_pos
      have hlt : f₁ t < g₁ t := by
        dsimp [f₁, g₁]
        rw [abs_mul, abs_mul, abs_of_nonneg hta]
        calc (t - a) * (|q t| * |u t|) = ((t - a) * |u t|) * |q t| := by ring
          _ < ((c - a) * M) * |q t| := mul_lt_mul_of_pos_right h1 hqpos
      exact not_lt_of_ge (h_ge t ⟨ht.1, ht.2.le⟩) hlt
    have hqc_zero : q c = 0 := by
      by_contra hqc
      have hq_cont_c : ContinuousAt q c := hq.continuousAt hnhds
      rw [Metric.continuousAt_iff] at hq_cont_c
      obtain ⟨δ, hδ_pos, hδ⟩ := hq_cont_c |q c| (abs_pos.mpr hqc)
      let t₀ := max ((a + c) / 2) (c - δ / 2)
      have ht₀_Ico : t₀ ∈ Ico a c := by
        refine ⟨?_, ?_⟩
        · exact le_trans (by linarith) (le_max_left _ _)
        · exact max_lt (by linarith) (by linarith)
      have hdist : dist t₀ c < δ := by
        rw [Real.dist_eq, abs_of_neg (sub_neg.mpr ht₀_Ico.2)]
        have : c - δ / 2 ≤ t₀ := le_max_right _ _
        linarith
      have hqt₀ := hδ hdist
      rw [hq_zero_Ico t₀ ht₀_Ico, Real.dist_eq, zero_sub, abs_neg] at hqt₀
      exact lt_irrefl _ hqt₀
    have hf₁_zero : ∀ t ∈ uIcc a c, f₁ t = 0 := by
      intro t ht
      rw [uIcc_of_le hac.le] at ht
      rcases eq_or_lt_of_le ht.2 with rfl | hlt
      · simp [f₁, hqc_zero]
      · simp [f₁, hq_zero_Ico t ⟨ht.1, hlt⟩]
    have hint_zero : ∫ t in a..c, f₁ t = 0 := by
      rw [integral_congr hf₁_zero, integral_zero]
    linarith
  have hlt1 : ∫ t in a..c, f₁ t < ∫ t in a..c, g₁ t :=
    integral_lt_integral_of_continuousOn_of_le_of_exists_lt hac hf₁_cont hg₁_cont
      (fun t ht => hf₁_le_g₁ t ⟨ht.1.le, ht.2⟩) hex_lt
  have hg₁_int : ∫ t in a..c, g₁ t = (c - a) * M * ∫ t in a..c, |q t| := by
    dsimp [g₁]
    exact integral_const_mul ((c - a) * M) _
  let f₂ : ℝ → ℝ := fun t => |(b - t) * (q t * u t)|
  let g₂ : ℝ → ℝ := fun t => (b - c) * M * |q t|
  have hf₂_cont : ContinuousOn f₂ (Icc c b) :=
    continuous_abs.comp_continuousOn <|
      (continuousOn_const.sub continuousOn_id).mul (hq_cb.mul hu_cont.continuousOn)
  have hg₂_cont : ContinuousOn g₂ (Icc c b) :=
    continuousOn_const.mul (continuous_abs.comp_continuousOn hq_cb)
  have hM_le_f₂ : M ≤ ∫ t in c..b, f₂ t := by
    calc M = |∫ t in c..b, (b - t) * (q t * u t)| := by rw [← huc_eq2]
      _ ≤ ∫ t in c..b, f₂ t := abs_integral_le_integral_abs hcb.le
  have hf₂_le_g₂ : ∀ t ∈ Icc c b, f₂ t ≤ g₂ t := by
    intro t ht
    have hbt : 0 ≤ b - t := sub_nonneg.mpr ht.2
    have hut : |u t| ≤ M := hc_max ⟨le_trans hac.le ht.1, ht.2⟩
    dsimp [f₂, g₂]
    rw [abs_mul, abs_mul, abs_of_nonneg hbt]
    have h2 : (b - t) * |u t| ≤ (b - c) * M :=
      mul_le_mul (sub_le_sub_left ht.1 b) hut (abs_nonneg _) (sub_nonneg.mpr hcb.le)
    calc (b - t) * (|q t| * |u t|) = ((b - t) * |u t|) * |q t| := by ring
      _ ≤ ((b - c) * M) * |q t| := mul_le_mul_of_nonneg_right h2 (abs_nonneg _)
  have hle2 : ∫ t in c..b, f₂ t ≤ ∫ t in c..b, g₂ t :=
    integral_mono_on hcb.le (hf₂_cont.intervalIntegrable_of_Icc hcb.le)
      (hg₂_cont.intervalIntegrable_of_Icc hcb.le) hf₂_le_g₂
  have hg₂_int : ∫ t in c..b, g₂ t = (b - c) * M * ∫ t in c..b, |q t| := by
    dsimp [g₂]
    exact integral_const_mul ((b - c) * M) _
  have hq_abs_cont : ContinuousOn (fun t => |q t|) (Icc a b) :=
    continuous_abs.comp_continuousOn hq
  have hI_add : (∫ t in a..c, |q t|) + (∫ t in c..b, |q t|) = ∫ t in a..b, |q t| := by
    apply integral_add_adjacent_intervals
    · exact (hq_abs_cont.mono (Icc_subset_Icc_right hcb.le)).intervalIntegrable_of_Icc hac.le
    · exact (hq_abs_cont.mono (Icc_subset_Icc_left hac.le)).intervalIntegrable_of_Icc hcb.le
  have hbound1 : M < (c - a) * M * ∫ t in a..c, |q t| := lt_of_le_of_lt hM_le_f₁ (hg₁_int ▸ hlt1)
  have hbound2 : M ≤ (b - c) * M * ∫ t in c..b, |q t| := le_trans hM_le_f₂ (hg₂_int ▸ hle2)
  exact problem1_alg a b c M (∫ t in a..c, |q t|) (∫ t in c..b, |q t|) (∫ t in a..b, |q t|)
    hac hcb hM_pos hbound1 hbound2 hI_add

end Problem1Aux

theorem problem1 (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  exact problem1_aux q u a b hab hq hu hode ha hb hne
