import Mathlib.Analysis.Calculus.ContDiff.Deriv
import Mathlib.Analysis.Calculus.Deriv.Mul
import Mathlib.Analysis.Calculus.LocalExtr.Basic
import Mathlib.MeasureTheory.Integral.IntervalIntegral.FundThmCalculus
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring

open Set MeasureTheory

private lemma endpoint_estimate (u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hu : ContDiff ℝ 2 u) (hne : u a ≠ u b)
    (hz : deriv u a = 0 ∨ deriv u b = 0) :
    |u b - u a| < (b - a) * ∫ x in a..b, |deriv (deriv u) x| := by
  have hd : ContDiff ℝ 1 (deriv u) := hu.deriv'
  have hc₁ : Continuous (deriv u) := hd.continuous
  have hc₂ : Continuous (deriv (deriv u)) := hd.continuous_deriv (by norm_num)
  have hi₁ : IntervalIntegrable (deriv u) volume a b := hc₁.intervalIntegrable a b
  have hi₂ : IntervalIntegrable (fun x => |deriv (deriv u) x|) volume a b :=
    hc₂.abs.intervalIntegrable a b
  let K := ∫ x in a..b, |deriv (deriv u) x|
  have hbound : ∀ x ∈ Icc a b, |deriv u x| ≤ K := by
    intro x hx
    rcases hz with hz | hz
    · have heq : (∫ t in a..x, deriv (deriv u) t) = deriv u x := by
        simpa [hz] using intervalIntegral.integral_eq_sub_of_hasDerivAt
          (fun t _ => (hd.differentiable (by norm_num) t).hasDerivAt)
          (hc₂.intervalIntegrable a x)
      calc
        |deriv u x| = |∫ t in a..x, deriv (deriv u) t| := by rw [heq]
        _ ≤ ∫ t in a..x, |deriv (deriv u) t| :=
          intervalIntegral.abs_integral_le_integral_abs hx.1
        _ ≤ K := intervalIntegral.integral_mono_interval le_rfl hx.1 hx.2
          (Filter.Eventually.of_forall (fun t => abs_nonneg _)) hi₂
    · have heq : (∫ t in x..b, deriv (deriv u) t) = -deriv u x := by
        simpa [hz] using intervalIntegral.integral_eq_sub_of_hasDerivAt
          (fun t _ => (hd.differentiable (by norm_num) t).hasDerivAt)
          (hc₂.intervalIntegrable x b)
      calc
        |deriv u x| = |∫ t in x..b, deriv (deriv u) t| := by rw [heq, abs_neg]
        _ ≤ ∫ t in x..b, |deriv (deriv u) t| :=
          intervalIntegral.abs_integral_le_integral_abs hx.2
        _ ≤ K := intervalIntegral.integral_mono_interval hx.1 hx.2 le_rfl
          (Filter.Eventually.of_forall (fun t => abs_nonneg _)) hi₂
  have hFTC : (∫ x in a..b, deriv u x) = u b - u a :=
    intervalIntegral.integral_eq_sub_of_hasDerivAt
      (fun x _ => (hu.differentiable (by norm_num) x).hasDerivAt) hi₁
  have hle : |u b - u a| ≤ (b - a) * K := by
    calc
      |u b - u a| = |∫ x in a..b, deriv u x| := by rw [hFTC]
      _ ≤ ∫ x in a..b, |deriv u x| :=
        intervalIntegral.abs_integral_le_integral_abs hab.le
      _ ≤ ∫ _ in a..b, K := intervalIntegral.integral_mono_on hab.le
        (hc₁.abs.intervalIntegrable a b) (intervalIntegrable_const) hbound
      _ = (b - a) * K := by simp
  have hK : 0 < K := by
    have hp : 0 < |u b - u a| := abs_pos.mpr (sub_ne_zero.mpr hne.symm)
    have hKnonneg : 0 ≤ K := intervalIntegral.integral_nonneg hab.le (fun _ _ => abs_nonneg _)
    nlinarith
  have hstrict : (∫ x in a..b, |deriv u x|) < ∫ _ in a..b, K := by
    apply intervalIntegral.integral_lt_integral_of_continuousOn_of_le_of_exists_lt
      hab hc₁.abs.continuousOn continuousOn_const
      (fun x hx => hbound x ⟨hx.1.le, hx.2⟩)
    rcases hz with hz | hz
    · exact ⟨a, left_mem_Icc.mpr hab.le, by simpa [hz] using hK⟩
    · exact ⟨b, right_mem_Icc.mpr hab.le, by simpa [hz] using hK⟩
  calc
    |u b - u a| = |∫ x in a..b, deriv u x| := by rw [hFTC]
    _ ≤ ∫ x in a..b, |deriv u x| :=
      intervalIntegral.abs_integral_le_integral_abs hab.le
    _ < ∫ _ in a..b, K := hstrict
    _ = (b - a) * ∫ x in a..b, |deriv (deriv u) x| := by simp [K]

theorem problem1 (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  obtain ⟨x₀, hx₀, hx₀u⟩ := hne
  obtain ⟨c, hc, hmax⟩ := isCompact_Icc.exists_isMaxOn
    (nonempty_Icc.mpr hab.le) (hu.continuous.mul hu.continuous).continuousOn
  have hcpos : 0 < u c * u c :=
    (mul_self_pos.mpr hx₀u).trans_le (hmax ⟨hx₀.1.le, hx₀.2.le⟩)
  have hcne : u c ≠ 0 := by
    intro h
    simp [h] at hcpos
  have hac : a < c := by
    rcases hc.1.eq_or_lt with h | h
    · exact False.elim (hcne (by rw [← h, ha]))
    · exact h
  have hcb : c < b := by
    rcases hc.2.eq_or_lt with h | h
    · exact False.elim (hcne (by rw [h, hb]))
    · exact h
  have hM : 0 < |u c| := abs_pos.mpr hcne
  have hbound : ∀ x ∈ Icc a b, |u x| ≤ |u c| := by
    intro x hx
    apply sq_le_sq.mp
    have hh : u x * u x ≤ u c * u c := hmax hx
    simpa only [pow_two] using hh
  have hdc : deriv u c = 0 := by
    have hd := (hu.differentiable (by norm_num) c).hasDerivAt
    have hh := (hmax.isLocalMax (Icc_mem_nhds hac hcb)).hasDerivAt_eq_zero (hd.mul hd)
    have hprod : u c * deriv u c = 0 := by nlinarith [hh]
    exact (mul_eq_zero.mp hprod).resolve_left hcne
  have hd : ContDiff ℝ 1 (deriv u) := hu.deriv'
  have hc₂ : Continuous (deriv (deriv u)) := hd.continuous_deriv (by norm_num)
  have hqL : ContinuousOn q (Icc a c) := hq.mono (Icc_subset_Icc_right hcb.le)
  have hqR : ContinuousOn q (Icc c b) := hq.mono (Icc_subset_Icc_left hac.le)
  have hleft : 1 < (c - a) * ∫ x in a..c, |q x| := by
    have hest := endpoint_estimate u a c hac hu (by simpa [ha] using hcne.symm)
      (Or.inr hdc)
    have hcomp : (∫ x in a..c, |deriv (deriv u) x|) ≤
        |u c| * ∫ x in a..c, |q x| := by
      rw [← intervalIntegral.integral_const_mul]
      apply intervalIntegral.integral_mono_on_of_le_Ioo hac.le
        (hc₂.abs.intervalIntegrable a c)
        ((continuousOn_const.mul hqL.abs).intervalIntegrable_of_Icc hac.le)
      intro x hx
      have hx' : x ∈ Ioo a b := ⟨hx.1, hx.2.trans hcb⟩
      have heq : deriv (deriv u) x = -(q x * u x) := by linarith [hode x hx']
      change |deriv (deriv u) x| ≤ |u c| * |q x|
      rw [heq, abs_neg, abs_mul, mul_comm |u c|]
      exact mul_le_mul_of_nonneg_left (hbound x ⟨hx.1.le, hx'.2.le⟩) (abs_nonneg _)
    rw [ha, sub_zero] at hest
    have hmul := mul_le_mul_of_nonneg_left hcomp (sub_nonneg.mpr hac.le)
    nlinarith
  have hright : 1 < (b - c) * ∫ x in c..b, |q x| := by
    have hest := endpoint_estimate u c b hcb hu (by simpa [hb] using hcne)
      (Or.inl hdc)
    have hcomp : (∫ x in c..b, |deriv (deriv u) x|) ≤
        |u c| * ∫ x in c..b, |q x| := by
      rw [← intervalIntegral.integral_const_mul]
      apply intervalIntegral.integral_mono_on_of_le_Ioo hcb.le
        (hc₂.abs.intervalIntegrable c b)
        ((continuousOn_const.mul hqR.abs).intervalIntegrable_of_Icc hcb.le)
      intro x hx
      have hx' : x ∈ Ioo a b := ⟨hac.trans hx.1, hx.2⟩
      have heq : deriv (deriv u) x = -(q x * u x) := by linarith [hode x hx']
      change |deriv (deriv u) x| ≤ |u c| * |q x|
      rw [heq, abs_neg, abs_mul, mul_comm |u c|]
      exact mul_le_mul_of_nonneg_left (hbound x ⟨hx'.1.le, hx.2.le⟩) (abs_nonneg _)
    rw [hb, zero_sub, abs_neg] at hest
    have hmul := mul_le_mul_of_nonneg_left hcomp (sub_nonneg.mpr hcb.le)
    nlinarith
  have hL : 0 < c - a := sub_pos.mpr hac
  have hR : 0 < b - c := sub_pos.mpr hcb
  have hleft' : 1 / (c - a) < ∫ x in a..c, |q x| :=
    (div_lt_iff₀ hL).mpr (by nlinarith [hleft])
  have hright' : 1 / (b - c) < ∫ x in c..b, |q x| :=
    (div_lt_iff₀ hR).mpr (by nlinarith [hright])
  have hsum : 1 / (c - a) + 1 / (b - c) < ∫ x in a..b, |q x| := by
    rw [← intervalIntegral.integral_add_adjacent_intervals
      (hqL.abs.intervalIntegrable_of_Icc hac.le) (hqR.abs.intervalIntegrable_of_Icc hcb.le)]
    exact add_lt_add hleft' hright'
  have halg : 4 ≤ (b - a) * (1 / (c - a) + 1 / (b - c)) := by
    have hp : 0 < (c - a) * (b - c) := mul_pos hL hR
    have heq : (b - a) * (1 / (c - a) + 1 / (b - c)) =
        (b - a) ^ 2 / ((c - a) * (b - c)) := by
      field_simp
      ring
    rw [heq]
    apply (le_div_iff₀ hp).mpr
    nlinarith [sq_nonneg ((c - a) - (b - c))]
  exact halg.trans_lt (mul_lt_mul_of_pos_left hsum (sub_pos.mpr hab))
