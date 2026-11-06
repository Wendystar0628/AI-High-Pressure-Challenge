import Mathlib.Analysis.Calculus.ContDiff.Deriv
import Mathlib.Analysis.Calculus.ContDiff.Operations
import Mathlib.Analysis.Calculus.Deriv.MeanValue
import Mathlib.Analysis.Calculus.LocalExtr.Basic
import Mathlib.MeasureTheory.Integral.IntervalIntegral.FundThmCalculus
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.Ring

open Set MeasureTheory

private lemma reciprocal_interval_bound (a b c : ℝ) (hac : a < c) (hcb : c < b) :
    4 ≤ (b - a) * (1 / (c - a) + 1 / (b - c)) := by
  have hx : 0 < c - a := sub_pos.mpr hac
  have hy : 0 < b - c := sub_pos.mpr hcb
  calc
    4 ≤ (b - a) ^ 2 / ((c - a) * (b - c)) :=
      (le_div_iff₀ (mul_pos hx hy)).mpr (by
        nlinarith [sq_nonneg ((c - a) - (b - c))])
    _ = (b - a) * (1 / (c - a) + 1 / (b - c)) := by
      field_simp
      <;> ring

private lemma lyapunov_at_positive_max (q u : ℝ → ℝ) (a b c : ℝ)
    (hac : a < c) (hcb : c < b)
    (hq : ContinuousOn q (Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hc : 0 < u c)
    (hder : deriv u c = 0) (hmax : ∀ t ∈ Icc a b, |u t| ≤ u c) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  have hab := hac.trans hcb
  have hd : Differentiable ℝ u := hu.differentiable (by norm_num)
  have hdc : Continuous (deriv u) := hu.continuous_deriv (by norm_num)
  have hdd : Differentiable ℝ (deriv u) := hu.differentiable_deriv_two
  have hddc : Continuous (deriv (deriv u)) :=
    (hu.deriv' : ContDiff ℝ 1 (deriv u)).continuous_deriv_one
  obtain ⟨x, hx, hxm⟩ := isCompact_Icc.exists_isMaxOn (nonempty_Icc.mpr hac.le)
    hdc.continuousOn
  obtain ⟨y, hy, hym⟩ := isCompact_Icc.exists_isMinOn (nonempty_Icc.mpr hcb.le)
    hdc.continuousOn
  have hftcl : (∫ t in a..c, deriv u t) = u c := by
    rw [intervalIntegral.integral_deriv_eq_sub (fun t _ => hd t)
      (hdc.intervalIntegrable a c), ha, sub_zero]
  have hftcr : (∫ t in c..b, deriv u t) = -u c := by
    rw [intervalIntegral.integral_deriv_eq_sub (fun t _ => hd t)
      (hdc.intervalIntegrable c b), hb, zero_sub]
  have hL0 : 0 < deriv u x := by
    have hi := intervalIntegral.integral_mono_on (μ := volume) hac.le (hdc.intervalIntegrable a c)
      (continuous_const.intervalIntegrable (a := a) (b := c)) (fun t ht => hxm ht)
    rw [hftcl, intervalIntegral.integral_const] at hi
    simp only [smul_eq_mul] at hi
    nlinarith
  have hleft : u c < (c - a) * deriv u x := by
    have hi := intervalIntegral.integral_lt_integral_of_continuousOn_of_le_of_exists_lt
      hac hdc.continuousOn (continuousOn_const : ContinuousOn (fun _ : ℝ => deriv u x) _)
      (fun t ht => hxm ⟨ht.1.le, ht.2⟩) ⟨c, ⟨hac.le, le_rfl⟩, by simpa [hder] using hL0⟩
    simpa only [hftcl, intervalIntegral.integral_const, smul_eq_mul] using hi
  have hright : u c ≤ (b - c) * (-deriv u y) := by
    have hi := intervalIntegral.integral_mono_on (μ := volume) hcb.le
      (continuous_const.intervalIntegrable (a := c) (b := b)) (hdc.intervalIntegrable c b)
      (fun t ht => hym ht)
    rw [hftcr, intervalIntegral.integral_const] at hi
    simp only [smul_eq_mul] at hi
    nlinarith
  have hxy : x ≤ y := hx.2.trans hy.1
  have hvariation : deriv u x - deriv u y ≤ ∫ t in a..b, |deriv (deriv u) t| := by
    have hftc : (∫ t in x..y, deriv (deriv u) t) = deriv u y - deriv u x :=
      intervalIntegral.integral_deriv_eq_sub (fun t _ => hdd t) (hddc.intervalIntegrable x y)
    have hn := intervalIntegral.abs_integral_le_integral_abs (μ := volume)
      (f := fun t => deriv (deriv u) t) hxy
    rw [hftc] at hn
    have hi := intervalIntegral.integral_mono_interval (μ := volume)
      (f := fun t => |deriv (deriv u) t|)
      hx.1 hxy hy.2 (Filter.Eventually.of_forall (fun t => abs_nonneg _))
      (hddc.abs.intervalIntegrable a b)
    have hh := neg_le_abs (deriv u y - deriv u x)
    linarith
  have hqint : IntervalIntegrable (fun t => |q t|) volume a b :=
    hq.abs.intervalIntegrable_of_Icc hab.le
  have hbound : (∫ t in a..b, |deriv (deriv u) t|) ≤
      (∫ t in a..b, |q t|) * u c := by
    have hi := intervalIntegral.integral_mono_on_of_le_Ioo (μ := volume) hab.le
      (hddc.abs.intervalIntegrable a b) (hqint.mul_const (u c)) (fun t ht => ?_)
    · simpa only [intervalIntegral.integral_mul_const] using hi
    · have he : deriv (deriv u) t = -(q t * u t) := by linarith [hode t ht]
      rw [he, abs_neg, abs_mul]
      exact mul_le_mul_of_nonneg_left (hmax t ⟨ht.1.le, ht.2.le⟩) (abs_nonneg _)
  have hratio : 1 / (c - a) + 1 / (b - c) < ∫ t in a..b, |q t| := by
    have hl : u c / (c - a) < deriv u x :=
      (div_lt_iff₀ (sub_pos.mpr hac)).mpr (by nlinarith [hleft])
    have hr : u c / (b - c) ≤ -deriv u y :=
      (div_le_iff₀ (sub_pos.mpr hcb)).mpr (by nlinarith [hright])
    have hsum : u c * (1 / (c - a) + 1 / (b - c)) <
        u c * (∫ t in a..b, |q t|) := by
      simp only [mul_add, mul_one_div]
      nlinarith
    exact (mul_lt_mul_iff_right₀ hc).mp hsum
  have := mul_lt_mul_of_pos_left hratio (sub_pos.mpr hab)
  exact (reciprocal_interval_bound a b c hac hcb).trans_lt this

theorem problem1 (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  obtain ⟨c, hc, hcm⟩ := isCompact_Icc.exists_isMaxOn (nonempty_Icc.mpr hab.le)
    hu.continuous.abs.continuousOn
  have hpos : 0 < |u c| := by
    obtain ⟨t, ht, hnt⟩ := hne
    exact (abs_pos.mpr hnt).trans_le (hcm ⟨ht.1.le, ht.2.le⟩)
  have hc0 : u c ≠ 0 := abs_pos.mp hpos
  have hca : c ≠ a := by rintro rfl; exact hc0 ha
  have hcb : c ≠ b := by rintro rfl; exact hc0 hb
  have hac : a < c := lt_of_le_of_ne hc.1 hca.symm
  have hcb' : c < b := lt_of_le_of_ne hc.2 hcb
  by_cases hsign : 0 ≤ u c
  · have hp : 0 < u c := by simpa [abs_of_nonneg hsign] using hpos
    have hm : ∀ t ∈ Icc a b, |u t| ≤ u c := by
      intro t ht
      simpa [abs_of_nonneg hsign] using hcm ht
    have hlocal : IsMaxOn u (Icc a b) c := fun t ht => (le_abs_self _).trans (hm t ht)
    have hd : deriv u c = 0 := (hlocal.isLocalMax (Icc_mem_nhds hac hcb')).deriv_eq_zero
    exact lyapunov_at_positive_max q u a b c hac hcb' hq hu hode ha hb hp hd hm
  · have hp : 0 < -u c := by linarith
    have hm : ∀ t ∈ Icc a b, |(-u) t| ≤ (-u) c := by
      intro t ht
      simpa only [Pi.neg_apply, abs_neg, abs_of_neg (lt_of_not_ge hsign)] using
        (show |u t| ≤ |u c| from hcm ht)
    have hlocal : IsMaxOn (-u) (Icc a b) c := fun t ht => (le_abs_self _).trans (hm t ht)
    have hd : deriv (-u) c = 0 :=
      (hlocal.isLocalMax (Icc_mem_nhds hac hcb')).deriv_eq_zero
    apply lyapunov_at_positive_max q (-u) a b c hac hcb' hq hu.neg ?_ ?_ ?_ hp hd hm
    · intro t ht
      simp only [deriv.neg', deriv.fun_neg, Pi.neg_apply]
      linarith [hode t ht]
    · simp [ha]
    · simp [hb]
