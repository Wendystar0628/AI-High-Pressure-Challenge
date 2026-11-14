import Mathlib.Analysis.Calculus.Deriv.MeanValue
import Mathlib.Analysis.Calculus.IteratedDeriv.Defs
import Mathlib.MeasureTheory.Integral.IntervalIntegral.FundThmCalculus
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity

open Set

private lemma deriv_eq_zero_of_abs_eq_max {u : ℝ → ℝ} {a b M t : ℝ}
    (ht : t ∈ Ioo a b) (hmax : ∀ x ∈ Icc a b, |u x| ≤ M) (hM : 0 ≤ M) (heq : |u t| = M) :
    deriv u t = 0 := by
  have hnhds : Icc a b ∈ nhds t := Icc_mem_nhds ht.1 ht.2
  rcases abs_eq hM |>.mp heq with hpos | hneg
  · have hloc : IsLocalMax u t := by
      refine Filter.Eventually.mono hnhds fun x hx => ?_
      exact (le_abs_self (u x)).trans ((hmax x hx).trans_eq hpos.symm)
    exact hloc.deriv_eq_zero
  · have hloc : IsLocalMin u t := by
      refine Filter.Eventually.mono hnhds fun x hx => ?_
      have h1 : -M ≤ -|u x| := neg_le_neg (hmax x hx)
      have h2 : -|u x| ≤ u x := neg_abs_le (u x)
      exact hneg.symm ▸ (h1.trans h2)
    exact hloc.deriv_eq_zero

private lemma strict_integral_lt_mul_max {q u : ℝ → ℝ} {a b p r M : ℝ}
    (hq : ContinuousOn q (Icc a b)) (hu : Continuous u)
    (hpr : p < r) (hsub_cc : Icc p r ⊆ Icc a b)
    (hbound : ∀ x ∈ Icc a b, |u x| ≤ M)
    (hlt : ∀ x ∈ Ioo p r, |u x| < M)
    (hpos : 0 < ∫ x in p..r, |q x| * |u x|) :
    ∫ x in p..r, |q x| * |u x| < M * ∫ x in p..r, |q x| := by
  have hq_cont : ContinuousOn (fun x => |q x|) (Icc p r) :=
    (hq.mono hsub_cc).abs
  have hu_cont : ContinuousOn (fun x => |u x|) (Icc p r) :=
    hu.abs.continuousOn
  have hqu_cont : ContinuousOn (fun x => |q x| * |u x|) (Icc p r) :=
    hq_cont.mul hu_cont
  have hqM_cont : ContinuousOn (fun x => |q x| * M) (Icc p r) :=
    hq_cont.mul continuousOn_const
  have hle : ∀ x ∈ Ioc p r, |q x| * |u x| ≤ |q x| * M := fun x hx =>
    mul_le_mul_of_nonneg_left (hbound x (hsub_cc (Ioc_subset_Icc_self hx))) (abs_nonneg _)
  have hex : ∃ c ∈ Icc p r, |q c| * |u c| < |q c| * M := by
    by_contra! hge
    have hzero_oo : ∀ x ∈ Ioo p r, |q x| * |u x| = 0 := by
      intro x hx
      have h1 : |q x| * M ≤ |q x| * |u x| := hge x (Ioo_subset_Icc_self hx)
      have h2 : |q x| * (M - |u x|) ≤ 0 := by linarith
      have h3 : 0 < M - |u x| := sub_pos.mpr (hlt x hx)
      have hq0 : |q x| ≤ 0 := nonpos_of_mul_nonpos_left h2 h3
      have hqeq : |q x| = 0 := le_antisymm hq0 (abs_nonneg _)
      simp [hqeq]
    have hint0 : ∫ x in p..r, |q x| * |u x| = 0 := by
      rw [intervalIntegral.integral_of_le hpr.le]
      have hae : (fun x => |q x| * |u x|) =ᵐ[MeasureTheory.volume.restrict (Ioc p r)] 0 := by
        refine MeasureTheory.ae_restrict_of_ae_eq_of_ae_restrict MeasureTheory.Ioo_ae_eq_Ioc ?_
        rw [MeasureTheory.ae_restrict_iff' measurableSet_Ioo]
        exact Filter.Eventually.of_forall hzero_oo
      rw [MeasureTheory.integral_congr_ae hae]
      simp
    linarith
  have hstrict := intervalIntegral.integral_lt_integral_of_continuousOn_of_le_of_exists_lt
    hpr hqu_cont hqM_cont hle hex
  have hmul : ∫ x in p..r, |q x| * M = M * ∫ x in p..r, |q x| := by
    rw [intervalIntegral.integral_mul_const M, mul_comm]
  rwa [hmul] at hstrict

theorem problem1 (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  have hu_cont : Continuous u := hu.continuous
  have hu_diff : Differentiable ℝ u := hu.differentiable (by decide)
  have hdu_diff : Differentiable ℝ (deriv u) := by
    simpa [iteratedDeriv_eq_iterate] using hu.differentiable_iteratedDeriv' 1
  have hdu2_cont : Continuous (deriv (deriv u)) := by
    simpa [iteratedDeriv_eq_iterate] using hu.continuous_iteratedDeriv' 2
  obtain ⟨c, hc_mem, hc_max⟩ :=
    isCompact_Icc.exists_isMaxOn (nonempty_Icc.mpr hab.le) hu_cont.abs.continuousOn
  set M := |u c|
  have hM : 0 < M := by
    obtain ⟨x₀, hx₀_mem, hx₀_ne⟩ := hne
    exact (abs_pos.mpr hx₀_ne).trans_le (hc_max (Ioo_subset_Icc_self hx₀_mem))
  have hbound : ∀ x ∈ Icc a b, |u x| ≤ M := fun x hx => hc_max hx
  set S : Set ℝ := {x ∈ Icc a b | |u x| = M}
  have hS_ne : S.Nonempty := ⟨c, hc_mem, rfl⟩
  have hS_closed : IsClosed S :=
    isClosed_Icc.inter (isClosed_eq hu_cont.abs continuous_const)
  have hS_bddBelow : BddBelow S := ⟨a, fun x hx => hx.1.1⟩
  have hS_bddAbove : BddAbove S := ⟨b, fun x hx => hx.1.2⟩
  set t₀ := sInf S
  set t₁ := sSup S
  have ht₀_mem : t₀ ∈ S := hS_closed.csInf_mem hS_ne hS_bddBelow
  have ht₁_mem : t₁ ∈ S := hS_closed.csSup_mem hS_ne hS_bddAbove
  have ht₀_le_t₁ : t₀ ≤ t₁ := (csInf_le hS_bddBelow ⟨hc_mem, rfl⟩).trans
    (le_csSup hS_bddAbove ⟨hc_mem, rfl⟩)
  have ht₀_oo : t₀ ∈ Ioo a b := by
    refine ⟨lt_of_le_of_ne ht₀_mem.1.1 ?_, lt_of_le_of_ne ht₀_mem.1.2 ?_⟩
    · intro h; have := ht₀_mem.2; rw [← h, ha, abs_zero] at this; linarith
    · intro h; have := ht₀_mem.2; rw [h, hb, abs_zero] at this; linarith
  have ht₁_oo : t₁ ∈ Ioo a b := by
    refine ⟨lt_of_le_of_ne ht₁_mem.1.1 ?_, lt_of_le_of_ne ht₁_mem.1.2 ?_⟩
    · intro h; have := ht₁_mem.2; rw [← h, ha, abs_zero] at this; linarith
    · intro h; have := ht₁_mem.2; rw [h, hb, abs_zero] at this; linarith
  have hdu_t₀ : deriv u t₀ = 0 :=
    deriv_eq_zero_of_abs_eq_max ht₀_oo hbound hM.le ht₀_mem.2
  have hdu_t₁ : deriv u t₁ = 0 :=
    deriv_eq_zero_of_abs_eq_max ht₁_oo hbound hM.le ht₁_mem.2
  -- Left bound: 1 / (t₀ - a) < ∫ x in a..t₀, |q x|
  have hleft : 1 / (t₀ - a) < ∫ x in a..t₀, |q x| := by
    obtain ⟨ξ₁, hξ₁_mem, hξ₁_slope⟩ :=
      exists_deriv_eq_slope u ht₀_oo.1 hu_cont.continuousOn hu_diff.differentiableOn
    have hξ₁_abs : |deriv u ξ₁| = M / (t₀ - a) := by
      rw [hξ₁_slope, ha, sub_zero, abs_div, ht₀_mem.2, abs_of_pos (sub_pos.mpr ht₀_oo.1)]
    have hftc : ∫ x in ξ₁..t₀, deriv (deriv u) x = deriv u t₀ - deriv u ξ₁ :=
      intervalIntegral.integral_eq_sub_of_hasDerivAt
        (fun x _ => (hdu_diff x).hasDerivAt) (hdu2_cont.intervalIntegrable _ _)
    have hsub_oo : Icc ξ₁ t₀ ⊆ Ioo a b := fun x hx =>
      ⟨hξ₁_mem.1.trans_le hx.1, hx.2.trans_lt ht₀_oo.2⟩
    have hcongr : ∫ x in ξ₁..t₀, deriv (deriv u) x = ∫ x in ξ₁..t₀, -(q x * u x) := by
      refine intervalIntegral.integral_congr fun x hx => ?_
      rw [uIcc_of_le hξ₁_mem.2.le] at hx
      linarith [hode x (hsub_oo hx)]
    have hint_eq : ∫ x in ξ₁..t₀, q x * u x = deriv u ξ₁ := by
      rw [hcongr, intervalIntegral.integral_neg, hdu_t₀, zero_sub] at hftc
      linarith
    have hle_int : M / (t₀ - a) ≤ ∫ x in ξ₁..t₀, |q x| * |u x| := by
      rw [← hξ₁_abs, ← hint_eq]
      calc |∫ x in ξ₁..t₀, q x * u x|
          ≤ ∫ x in ξ₁..t₀, |q x * u x| :=
            intervalIntegral.abs_integral_le_integral_abs hξ₁_mem.2.le
        _ = ∫ x in ξ₁..t₀, |q x| * |u x| := by simp_rw [abs_mul]
    have hpos_int : 0 < ∫ x in ξ₁..t₀, |q x| * |u x| :=
      lt_of_lt_of_le (div_pos hM (sub_pos.mpr ht₀_oo.1)) hle_int
    have hlt_M : ∀ x ∈ Ioo ξ₁ t₀, |u x| < M := by
      intro x hx
      refine lt_of_le_of_ne (hbound x ⟨(hξ₁_mem.1.trans hx.1).le, hx.2.le.trans ht₀_oo.2.le⟩) ?_
      intro heq
      have hxS : x ∈ S := ⟨⟨(hξ₁_mem.1.trans hx.1).le, hx.2.le.trans ht₀_oo.2.le⟩, heq⟩
      exact absurd (csInf_le hS_bddBelow hxS) (not_le_of_gt hx.2)
    have hstrict := strict_integral_lt_mul_max hq hu_cont hξ₁_mem.2
      (hsub_oo.trans Ioo_subset_Icc_self) hbound hlt_M hpos_int
    have hmono : ∫ x in ξ₁..t₀, |q x| ≤ ∫ x in a..t₀, |q x| := by
      refine intervalIntegral.integral_mono_interval hξ₁_mem.1.le hξ₁_mem.2.le le_rfl ?_ ?_
      · exact Filter.Eventually.of_forall fun x => abs_nonneg _
      · exact (hq.mono (Icc_subset_Icc_right ht₀_oo.2.le)).abs.intervalIntegrable_of_Icc ht₀_oo.1.le
    have h1 : M / (t₀ - a) < M * ∫ x in a..t₀, |q x| :=
      hle_int.trans_lt (hstrict.trans_le (mul_le_mul_of_nonneg_left hmono hM.le))
    rw [div_eq_mul_one_div] at h1
    exact lt_of_mul_lt_mul_left h1 hM.le
  -- Right bound: 1 / (b - t₁) < ∫ x in t₁..b, |q x|
  have hright : 1 / (b - t₁) < ∫ x in t₁..b, |q x| := by
    obtain ⟨ξ₂, hξ₂_mem, hξ₂_slope⟩ :=
      exists_deriv_eq_slope u ht₁_oo.2 hu_cont.continuousOn hu_diff.differentiableOn
    have hξ₂_abs : |deriv u ξ₂| = M / (b - t₁) := by
      rw [hξ₂_slope, hb, zero_sub, abs_div, abs_neg, ht₁_mem.2, abs_of_pos (sub_pos.mpr ht₁_oo.2)]
    have hftc : ∫ x in t₁..ξ₂, deriv (deriv u) x = deriv u ξ₂ - deriv u t₁ :=
      intervalIntegral.integral_eq_sub_of_hasDerivAt
        (fun x _ => (hdu_diff x).hasDerivAt) (hdu2_cont.intervalIntegrable _ _)
    have hsub_oo : Icc t₁ ξ₂ ⊆ Ioo a b := fun x hx =>
      ⟨ht₁_oo.1.trans_le hx.1, hx.2.trans_lt hξ₂_mem.2⟩
    have hcongr : ∫ x in t₁..ξ₂, deriv (deriv u) x = ∫ x in t₁..ξ₂, -(q x * u x) := by
      refine intervalIntegral.integral_congr fun x hx => ?_
      rw [uIcc_of_le hξ₂_mem.1.le] at hx
      linarith [hode x (hsub_oo hx)]
    have hint_eq : ∫ x in t₁..ξ₂, q x * u x = - deriv u ξ₂ := by
      rw [hcongr, intervalIntegral.integral_neg, hdu_t₁, sub_zero] at hftc
      linarith
    have hle_int : M / (b - t₁) ≤ ∫ x in t₁..ξ₂, |q x| * |u x| := by
      rw [← hξ₂_abs, ← abs_neg (deriv u ξ₂), ← hint_eq]
      calc |∫ x in t₁..ξ₂, q x * u x|
          ≤ ∫ x in t₁..ξ₂, |q x * u x| :=
            intervalIntegral.abs_integral_le_integral_abs hξ₂_mem.1.le
        _ = ∫ x in t₁..ξ₂, |q x| * |u x| := by simp_rw [abs_mul]
    have hpos_int : 0 < ∫ x in t₁..ξ₂, |q x| * |u x| :=
      lt_of_lt_of_le (div_pos hM (sub_pos.mpr ht₁_oo.2)) hle_int
    have hlt_M : ∀ x ∈ Ioo t₁ ξ₂, |u x| < M := by
      intro x hx
      refine lt_of_le_of_ne (hbound x ⟨ht₁_oo.1.le.trans hx.1.le, (hx.2.trans hξ₂_mem.2).le⟩) ?_
      intro heq
      have hxS : x ∈ S := ⟨⟨ht₁_oo.1.le.trans hx.1.le, (hx.2.trans hξ₂_mem.2).le⟩, heq⟩
      exact absurd (le_csSup hS_bddAbove hxS) (not_le_of_gt hx.1)
    have hstrict := strict_integral_lt_mul_max hq hu_cont hξ₂_mem.1
      (hsub_oo.trans Ioo_subset_Icc_self) hbound hlt_M hpos_int
    have hmono : ∫ x in t₁..ξ₂, |q x| ≤ ∫ x in t₁..b, |q x| := by
      refine intervalIntegral.integral_mono_interval le_rfl hξ₂_mem.1.le hξ₂_mem.2.le ?_ ?_
      · exact Filter.Eventually.of_forall fun x => abs_nonneg _
      · exact (hq.mono (Icc_subset_Icc_left ht₁_oo.1.le)).abs.intervalIntegrable_of_Icc ht₁_oo.2.le
    have h1 : M / (b - t₁) < M * ∫ x in t₁..b, |q x| :=
      hle_int.trans_lt (hstrict.trans_le (mul_le_mul_of_nonneg_left hmono hM.le))
    rw [div_eq_mul_one_div] at h1
    exact lt_of_mul_lt_mul_left h1 hM.le
  -- Combine left and right integrals
  have hq_int_at₁ : IntervalIntegrable (fun x => |q x|) MeasureTheory.volume a t₁ :=
    (hq.mono (Icc_subset_Icc_right ht₁_oo.2.le)).abs.intervalIntegrable_of_Icc ht₁_oo.1.le
  have hq_int_t₁b : IntervalIntegrable (fun x => |q x|) MeasureTheory.volume t₁ b :=
    (hq.mono (Icc_subset_Icc_left ht₁_oo.1.le)).abs.intervalIntegrable_of_Icc ht₁_oo.2.le
  have hle_at₁ : ∫ x in a..t₀, |q x| ≤ ∫ x in a..t₁, |q x| :=
    intervalIntegral.integral_mono_interval le_rfl ht₀_oo.1.le ht₀_le_t₁
      (Filter.Eventually.of_forall fun x => abs_nonneg _) hq_int_at₁
  have hsum_int : (∫ x in a..t₁, |q x|) + ∫ x in t₁..b, |q x| = ∫ x in a..b, |q x| :=
    intervalIntegral.integral_add_adjacent_intervals hq_int_at₁ hq_int_t₁b
  have hinv_lt : 1 / (t₀ - a) + 1 / (b - t₁) < ∫ x in a..b, |q x| := by
    linarith [hleft, hright, hle_at₁, hsum_int]
  -- Elementary AM-GM / Cauchy-Schwarz
  set x₁ := t₀ - a
  set x₂ := b - t₁
  have hx₁ : 0 < x₁ := sub_pos.mpr ht₀_oo.1
  have hx₂ : 0 < x₂ := sub_pos.mpr ht₁_oo.2
  have hsum_le : x₁ + x₂ ≤ b - a := by linarith [ht₀_le_t₁]
  have hamgm : 4 ≤ (x₁ + x₂) * (1 / x₁ + 1 / x₂) := by
    have hdiff : 0 ≤ (x₁ - x₂) ^ 2 / (x₁ * x₂) := by positivity
    have hid : (x₁ + x₂) * (1 / x₁ + 1 / x₂) - 4 = (x₁ - x₂) ^ 2 / (x₁ * x₂) := by
      field_simp
      ring
    linarith
  have hinv_pos : 0 < 1 / x₁ + 1 / x₂ := by positivity
  have hmul1 : 4 ≤ (b - a) * (1 / x₁ + 1 / x₂) :=
    hamgm.trans (mul_le_mul_of_nonneg_right hsum_le hinv_pos.le)
  have hmul2 : (b - a) * (1 / x₁ + 1 / x₂) < (b - a) * ∫ x in a..b, |q x| :=
    mul_lt_mul_of_pos_left hinv_lt (sub_pos.mpr hab)
  exact hmul1.trans_lt hmul2
