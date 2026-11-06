import Mathlib.Analysis.Calculus.Deriv.MeanValue
import Mathlib.Analysis.Calculus.ContDiff.Deriv
import Mathlib.MeasureTheory.Integral.IntervalIntegral.FundThmCalculus
import Mathlib.Analysis.Calculus.LocalExtr.Basic

open Set Filter Topology

theorem problem1 (q u : ℝ → ℝ) (a b : ℝ) (hab : a < b)
    (hq : ContinuousOn q (Set.Icc a b)) (hu : ContDiff ℝ 2 u)
    (hode : ∀ x ∈ Set.Ioo a b, deriv (deriv u) x + q x * u x = 0)
    (ha : u a = 0) (hb : u b = 0) (hne : ∃ x ∈ Set.Ioo a b, u x ≠ 0) :
    4 < (b - a) * ∫ x in a..b, |q x| := by
  -- regularity
  have hu1 : Differentiable ℝ u := hu.differentiable (by norm_num)
  have hdu : ContDiff ℝ 1 (deriv u) := by
    have h := hu
    rw [show (2 : WithTop ℕ∞) = 1 + 1 from rfl, contDiff_succ_iff_deriv] at h
    exact h.2.2
  have hu2 : Differentiable ℝ (deriv u) := hdu.differentiable (by norm_num)
  have hu3 : Continuous (deriv (deriv u)) := hdu.continuous_deriv (le_refl _)
  have hu0 : Continuous u := hu.continuous
  have hdu0 : Continuous (deriv u) := hdu.continuous
  -- maximum of |u|
  obtain ⟨c, hcI, hcmax⟩ := isCompact_Icc.exists_isMaxOn (nonempty_Icc.mpr hab.le)
    (hu0.abs.continuousOn : ContinuousOn (fun x => |u x|) (Icc a b))
  set M := |u c| with hM
  have hle : ∀ x ∈ Icc a b, |u x| ≤ M := fun x hx => hcmax hx
  obtain ⟨x₀, hx₀, hux₀⟩ := hne
  have hMpos : 0 < M := lt_of_lt_of_le (abs_pos.mpr hux₀) (hle x₀ (Ioo_subset_Icc_self hx₀))
  have hca : a < c := by
    rcases eq_or_lt_of_le hcI.1 with h | h
    · exfalso; rw [← h, ha, abs_zero] at hM; linarith
    · exact h
  have hcb : c < b := by
    rcases eq_or_lt_of_le hcI.2 with h | h
    · exfalso; rw [h, hb, abs_zero] at hM; linarith
    · exact h
  -- mean value theorem
  obtain ⟨ξ, hξ, hξd⟩ := exists_deriv_eq_slope u hca hu0.continuousOn hu1.differentiableOn
  obtain ⟨η, hη, hηd⟩ := exists_deriv_eq_slope u hcb hu0.continuousOn hu1.differentiableOn
  rw [ha, sub_zero] at hξd
  rw [hb, zero_sub] at hηd
  have hξ' : deriv u ξ * (c - a) = u c := by
    rw [hξd]; field_simp [(sub_pos.mpr hca).ne']
  have hη' : deriv u η * (b - c) = - u c := by
    rw [hηd]; field_simp [(sub_pos.mpr hcb).ne']
  have hξη : ξ < η := hξ.2.trans hη.1
  have hsubI : Icc ξ η ⊆ Ioo a b := fun x hx => ⟨hξ.1.trans_le hx.1, hx.2.trans_lt hη.2⟩
  -- FTC
  have hFTC : deriv u η - deriv u ξ = ∫ x in ξ..η, -(q x * u x) := by
    rw [← intervalIntegral.integral_deriv_eq_sub (fun x _ => hu2 x) (hu3.intervalIntegrable _ _)]
    apply intervalIntegral.integral_congr
    intro x hx
    rw [uIcc_of_le hξη.le] at hx
    have := hode x (hsubI hx)
    simp only
    linarith
  have hDAB : |deriv u η - deriv u ξ| * ((c - a) * (b - c)) = M * (b - a) := by
    have h1 : (deriv u η - deriv u ξ) * ((c - a) * (b - c)) = -(u c) * (b - a) := by
      linear_combination (c - a) * hη' - (b - c) * hξ'
    have hAB : 0 < (c - a) * (b - c) := mul_pos (sub_pos.mpr hca) (sub_pos.mpr hcb)
    rw [← abs_of_pos hAB, ← abs_mul, h1, abs_mul, abs_neg, abs_of_pos (sub_pos.mpr hab)]
  -- integrability
  have hqcI : ContinuousOn (fun x => |q x|) (Icc ξ η) :=
    (hq.mono (fun x hx => Ioo_subset_Icc_self (hsubI hx))).abs
  have hqint : IntervalIntegrable (fun x => |q x|) MeasureTheory.volume a b :=
    hq.abs.intervalIntegrable_of_Icc hab.le
  have hJK : ∫ x in ξ..η, |q x| ≤ ∫ x in a..b, |q x| :=
    intervalIntegral.integral_mono_interval hξ.1.le hξη.le hη.2.le
      (Eventually.of_forall fun x => abs_nonneg (q x)) hqint
  have hD1 : |deriv u η - deriv u ξ| ≤ ∫ x in ξ..η, |q x| * |u x| := by
    rw [hFTC]
    calc |∫ x in ξ..η, -(q x * u x)| ≤ ∫ x in ξ..η, |-(q x * u x)| :=
          intervalIntegral.abs_integral_le_integral_abs hξη.le
      _ = ∫ x in ξ..η, |q x| * |u x| := by
          apply intervalIntegral.integral_congr
          intro x _
          simp only [abs_neg, abs_mul]
  by_cases hA : ∃ t ∈ Ioo ξ η, q t ≠ 0 ∧ |u t| < M
  · obtain ⟨t, ht, hqt, hut⟩ := hA
    have hstrict : ∫ x in ξ..η, |q x| * |u x| < ∫ x in ξ..η, M * |q x| := by
      apply intervalIntegral.integral_lt_integral_of_continuousOn_of_le_of_exists_lt hξη
      · exact hqcI.mul (hu0.abs.continuousOn)
      · exact continuousOn_const.mul hqcI
      · intro x hx
        have := hle x (Ioo_subset_Icc_self (hsubI (Ioc_subset_Icc_self hx)))
        rw [mul_comm M]
        exact mul_le_mul_of_nonneg_left this (abs_nonneg _)
      · refine ⟨t, Ioo_subset_Icc_self ht, ?_⟩
        rw [mul_comm M]
        exact mul_lt_mul_of_pos_left hut (abs_pos.mpr hqt)
    rw [intervalIntegral.integral_const_mul] at hstrict
    set K := ∫ x in a..b, |q x| with hK
    have hDK : |deriv u η - deriv u ξ| < M * K := by
      calc |deriv u η - deriv u ξ| < M * ∫ x in ξ..η, |q x| := hD1.trans_lt hstrict
        _ ≤ M * K := mul_le_mul_of_nonneg_left hJK hMpos.le
    have hAB : 0 < (c - a) * (b - c) := mul_pos (sub_pos.mpr hca) (sub_pos.mpr hcb)
    have h1 : M * (b - a) < M * (K * ((c - a) * (b - c))) := by
      rw [← hDAB]
      have := mul_lt_mul_of_pos_right hDK hAB
      linarith
    have h2 : b - a < K * ((c - a) * (b - c)) := (mul_lt_mul_iff_right₀ hMpos).mp h1
    have h3 : 4 * ((c - a) * (b - c)) ≤ (b - a) ^ 2 := by
      nlinarith [sq_nonneg ((c - a) - (b - c))]
    have hKpos : 0 < K := by
      by_contra hneg
      push_neg at hneg
      nlinarith
    nlinarith [mul_le_mul_of_nonneg_left h3 hKpos.le]
  · exfalso
    push_neg at hA
    have hBeq : ∀ t ∈ Ioo ξ η, q t ≠ 0 → |u t| = M := by
      intro t ht hqt
      exact le_antisymm (hle t (Ioo_subset_Icc_self (hsubI (Ioo_subset_Icc_self ht))))
        (hA t ht hqt)
    have hqzero : ∀ t ∈ Ioo ξ η, q t = 0 := by
      intro t₀ ht₀
      by_contra hq0
      have ht₀ab : t₀ ∈ Ioo a b := hsubI (Ioo_subset_Icc_self ht₀)
      have hcontq : ContinuousAt q t₀ := hq.continuousAt (Icc_mem_nhds ht₀ab.1 ht₀ab.2)
      have hev1 : ∀ᶠ t in 𝓝 t₀, q t ≠ 0 := hcontq.eventually_ne hq0
      have hev2 : ∀ᶠ t in 𝓝 t₀, t ∈ Ioo ξ η := Ioo_mem_nhds ht₀.1 ht₀.2
      have hev3 : ∀ᶠ t in 𝓝 t₀, deriv u t = 0 := by
        filter_upwards [hev1, hev2] with t ht1 ht2
        have htab : t ∈ Ioo a b := hsubI (Ioo_subset_Icc_self ht2)
        have hut : |u t| = M := hBeq t ht2 ht1
        have hnear : ∀ᶠ s in 𝓝 t, s ∈ Icc a b := Icc_mem_nhds htab.1 htab.2
        rcases (abs_eq hMpos.le).mp hut with h | h
        · have hmax : IsLocalMax u t := by
            filter_upwards [hnear] with s hs
            rw [h]; exact (le_abs_self _).trans (hle s hs)
          exact hmax.deriv_eq_zero
        · have hmin : IsLocalMin u t := by
            filter_upwards [hnear] with s hs
            rw [h]; exact neg_le_of_abs_le (hle s hs)
          exact hmin.deriv_eq_zero
      have hdd : deriv (deriv u) t₀ = 0 := by
        have hev4 : deriv u =ᶠ[𝓝 t₀] fun _ => (0 : ℝ) := hev3
        rw [hev4.deriv_eq]
        simp
      have h1 := hode t₀ ht₀ab
      rw [hdd, zero_add] at h1
      have hut0 : u t₀ ≠ 0 := by
        have hut := hBeq t₀ ht₀ hq0
        intro h; rw [h, abs_zero] at hut; linarith
      exact hq0 ((mul_eq_zero.mp h1).resolve_right hut0)
    obtain ⟨θ, hθ, hθd⟩ := exists_deriv_eq_slope (deriv u) hξη hdu0.continuousOn
      hu2.differentiableOn
    have hθ0 : deriv (deriv u) θ = 0 := by
      have := hode θ (hsubI (Ioo_subset_Icc_self hθ))
      rw [hqzero θ hθ, zero_mul, add_zero] at this
      exact this
    rw [hθ0, eq_comm, div_eq_zero_iff] at hθd
    rcases hθd with h | h
    · have heq : deriv u η = deriv u ξ := by linarith
      rw [heq] at hη'
      have h2 : deriv u ξ * (b - a) = 0 := by linear_combination hξ' + hη'
      have h3 : deriv u ξ = 0 := by
        rcases mul_eq_zero.mp h2 with h4 | h4
        · exact h4
        · exfalso; linarith
      rw [h3, zero_mul] at hξ'
      rw [← hξ', abs_zero] at hM
      linarith
    · linarith
