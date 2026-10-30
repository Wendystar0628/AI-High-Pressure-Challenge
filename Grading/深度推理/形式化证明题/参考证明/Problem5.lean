import Mathlib.Analysis.Complex.Schwarz
import Mathlib.Analysis.Complex.OpenMapping
import Mathlib.Analysis.SpecificLimits.Normed
import Mathlib.Topology.UniformSpace.LocallyUniformConvergence
import Mathlib.Topology.Order.MonotoneConvergence
import Mathlib.Topology.Bornology.BoundedOperation
import Mathlib.Analysis.Normed.Field.Lemmas
import Mathlib.Tactic.Choose
import Mathlib.Tactic.FieldSimp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.LinearCombination
import Mathlib.Tactic.Positivity

open Set Metric Filter Function
open scoped Topology ComplexConjugate

noncomputable section

namespace DW

def mob (a z : ℂ) : ℂ := (a - z) / (1 - conj a * z)

lemma den_ne {a z : ℂ} (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    1 - conj a * z ≠ 0 := by
  apply sub_ne_zero.mpr
  intro h
  have hlt : ‖conj a * z‖ < 1 := by
    rw [norm_mul, Complex.norm_conj]
    nlinarith [norm_nonneg a, norm_nonneg z]
  rw [← h, norm_one] at hlt
  exact lt_irrefl _ hlt

lemma normSq_den_sub (a z : ℂ) :
    Complex.normSq (1 - conj a * z) - Complex.normSq (z - a) =
      (1 - Complex.normSq a) * (1 - Complex.normSq z) := by
  simp only [Complex.normSq_apply, Complex.sub_re, Complex.sub_im,
    Complex.mul_re, Complex.mul_im, Complex.conj_re, Complex.conj_im,
    Complex.one_re, Complex.one_im]
  ring

lemma ns_lt {z : ℂ} (hz : ‖z‖ < 1) : Complex.normSq z < 1 := by
  rw [Complex.normSq_eq_norm_sq]
  nlinarith [norm_nonneg z]

lemma mob_mem {a z : ℂ} (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) : ‖mob a z‖ < 1 := by
  rw [mob, norm_div, norm_sub_rev a z, div_lt_one (norm_pos_iff.mpr (den_ne ha hz))]
  have h := normSq_den_sub a z
  rw [Complex.normSq_eq_norm_sq, Complex.normSq_eq_norm_sq] at h
  have hp := mul_pos (sub_pos.mpr (ns_lt ha)) (sub_pos.mpr (ns_lt hz))
  nlinarith [norm_nonneg (z-a), norm_nonneg (1-conj a*z)]

lemma mob_invol {a z : ℂ} (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    mob a (mob a z) = z := by
  have h₁ := den_ne ha hz
  have h₂ := den_ne ha (mob_mem ha hz)
  rw [mob, div_eq_iff h₂]
  change a - (a - z) / (1 - conj a * z) =
    z * (1 - conj a * ((a - z) / (1 - conj a * z)))
  apply (mul_right_injective₀ h₁)
  field_simp
  ring

lemma mob_diff {a : ℂ} (ha : ‖a‖ < 1) :
    DifferentiableOn ℂ (mob a) (ball 0 1) := by
  apply DifferentiableOn.div
    ((differentiableOn_const a).sub differentiableOn_id)
    ((differentiableOn_const 1).sub ((differentiableOn_const (conj a)).mul differentiableOn_id))
  intro z hz
  exact den_ne ha (mem_ball_zero_iff.mp hz)

lemma pick {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {a z : ℂ}
    (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    ‖mob (f a) (f z)‖ ≤ ‖mob a z‖ := by
  have hfa : ‖f a‖ < 1 := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr ha))
  have hma : MapsTo (mob a) (ball 0 1) (ball 0 1) := fun w hw =>
    mem_ball_zero_iff.mpr (mob_mem ha (mem_ball_zero_iff.mp hw))
  let g := mob (f a) ∘ f ∘ mob a
  have hg : DifferentiableOn ℂ g (ball 0 1) :=
    (mob_diff hfa).comp (hf.comp (mob_diff ha) hma) (hm.comp hma)
  have hgm : MapsTo g (ball 0 1) (closedBall 0 1) := by
    intro w hw
    apply ball_subset_closedBall
    exact mem_ball_zero_iff.mpr (mob_mem hfa (mem_ball_zero_iff.mp (hm (hma hw))))
  have hg0 : g 0 = 0 := by simp [g, mob]
  have h := Complex.norm_le_norm_of_mapsTo_ball hg hgm hg0 (mob_mem ha hz)
  simpa [g, mob_invol ha hz] using h

lemma pick_kernel {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {a z : ℂ}
    (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    Complex.normSq (1 - conj (f a) * f z) * (1 - Complex.normSq a) *
      (1 - Complex.normSq z) ≤
    Complex.normSq (1 - conj a * z) * (1 - Complex.normSq (f a)) *
      (1 - Complex.normSq (f z)) := by
  have hfa : ‖f a‖ < 1 := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr ha))
  have hfz : ‖f z‖ < 1 := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz))
  have h := pick hf hm ha hz
  rw [mob, mob, norm_div, norm_div] at h
  have hd := norm_pos_iff.mpr (den_ne ha hz)
  have hdf := norm_pos_iff.mpr (den_ne hfa hfz)
  have he := (div_le_div_iff₀ hdf hd).mp h
  have he2 := mul_self_le_mul_self (by positivity : 0 ≤ ‖f a - f z‖ * ‖1-conj a*z‖) he
  have h₁ := normSq_den_sub a z
  have h₂ := normSq_den_sub (f a) (f z)
  simp only [Complex.normSq_eq_norm_sq] at h₁ h₂ ⊢
  rw [norm_sub_rev z a] at h₁
  rw [norm_sub_rev (f z) (f a)] at h₂
  simp only [mul_assoc]
  rw [← h₁, ← h₂]
  nlinarith only [he2]

lemma radius_bound {r : ℝ} (hr : 0 ≤ r) (hr1 : r < 1) :
    ∃ q : ℝ, 0 ≤ q ∧ q < 1 ∧ ∀ a z : ℂ, ‖a‖ ≤ r → ‖z‖ ≤ r → ‖mob a z‖ ≤ q := by
  let K : Set (ℂ × ℂ) := closedBall 0 r ×ˢ closedBall 0 r
  have hc : IsCompact K := (isCompact_closedBall (0 : ℂ) r).prod (isCompact_closedBall 0 r)
  have hn : K.Nonempty := ⟨(0, 0), by simp [K, hr]⟩
  have hd : ∀ p ∈ K, 1 - conj p.1 * p.2 ≠ 0 := by
    intro p hp
    exact den_ne ((mem_closedBall_zero_iff.mp hp.1).trans_lt hr1)
      ((mem_closedBall_zero_iff.mp hp.2).trans_lt hr1)
  have hcont : ContinuousOn (fun p : ℂ × ℂ => ‖mob p.1 p.2‖) K := by
    apply ContinuousOn.norm
    exact (continuous_fst.sub continuous_snd).continuousOn.div
      (continuous_const.sub ((Complex.continuous_conj.comp continuous_fst).mul
        continuous_snd)).continuousOn hd
  obtain ⟨p, hp, hmax⟩ := hc.exists_isMaxOn hn hcont
  refine ⟨‖mob p.1 p.2‖, norm_nonneg _, ?_, ?_⟩
  · exact mob_mem ((mem_closedBall_zero_iff.mp hp.1).trans_lt hr1)
      ((mem_closedBall_zero_iff.mp hp.2).trans_lt hr1)
  · intro a z ha hz
    exact hmax (show (a,z) ∈ K from
      ⟨mem_closedBall_zero_iff.mpr ha, mem_closedBall_zero_iff.mpr hz⟩)

lemma scale_pick {r q : ℝ} (hr : 0 ≤ r) (hr1 : r < 1)
    (hq : ∀ a z : ℂ, ‖a‖ ≤ r → ‖z‖ ≤ r → ‖mob a z‖ ≤ q)
    {a z : ℂ} (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    ‖mob ((r : ℂ) * a) ((r : ℂ) * z)‖ ≤ q * ‖mob a z‖ := by
  have hnorm : ∀ u : ℂ, ‖u‖ < 1 → ‖(r : ℂ) * u‖ ≤ r := by
    intro u hu
    rw [norm_mul, Complex.norm_real, Real.norm_of_nonneg hr]
    nlinarith
  have hra : ‖(r : ℂ) * a‖ < 1 := (hnorm a ha).trans_lt hr1
  have hma : MapsTo (mob a) (ball 0 1) (ball 0 1) := fun w hw =>
    mem_ball_zero_iff.mpr (mob_mem ha (mem_ball_zero_iff.mp hw))
  let g : ℂ → ℂ := fun w => mob ((r : ℂ) * a) ((r : ℂ) * mob a w)
  have hscale : DifferentiableOn ℂ (fun w => (r : ℂ) * mob a w) (ball 0 1) :=
    (mob_diff ha).const_mul _
  have hg : DifferentiableOn ℂ g (ball 0 1) :=
    (mob_diff hra).comp hscale (fun w hw =>
      mem_ball_zero_iff.mpr ((hnorm _ (mem_ball_zero_iff.mp (hma hw))).trans_lt hr1))
  have hgm : MapsTo g (ball 0 1) (closedBall 0 q) := by
    intro w hw
    exact mem_closedBall_zero_iff.mpr
      (hq _ _ (hnorm a ha) (hnorm _ (mem_ball_zero_iff.mp (hma hw))))
  have hg0 : g 0 = 0 := by simp [g, mob]
  have h := Complex.dist_le_div_mul_dist_of_mapsTo_ball hg
    (by simpa only [hg0] using hgm) (mem_ball_zero_iff.mpr (mob_mem ha hz))
  rw [hg0] at h
  simpa [g, mob_invol ha hz] using h

lemma sub_le_mob {a z : ℂ} (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) :
    ‖a - z‖ ≤ 2 * ‖mob a z‖ := by
  have hd := norm_pos_iff.mpr (den_ne ha hz)
  have hb : ‖1 - conj a * z‖ ≤ 2 := by
    calc
      _ ≤ ‖(1 : ℂ)‖ + ‖conj a * z‖ := norm_sub_le _ _
      _ ≤ 2 := by rw [norm_one, norm_mul, Complex.norm_conj]; nlinarith [norm_nonneg a, norm_nonneg z]
  rw [mob, norm_div]
  rw [← mul_div_assoc]
  apply (le_div_iff₀ hd).mpr
  nlinarith [norm_nonneg (a-z)]

lemma scaled_fixed {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {r : ℝ} (hr : 0 ≤ r) (hr1 : r < 1) :
    ∃ a : ℂ, ‖a‖ < 1 ∧ (r : ℂ) * f a = a := by
  obtain ⟨q, hq0, hq1, hq⟩ := radius_bound hr hr1
  let g : ℂ → ℂ := fun z => (r : ℂ) * f z
  have hgR : ∀ z, ‖z‖ < 1 → ‖g z‖ ≤ r := by
    intro z hz
    have h := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz))
    dsimp [g]
    rw [norm_mul, Complex.norm_real, Real.norm_of_nonneg hr]
    nlinarith
  have hgm : MapsTo g (ball 0 1) (ball 0 1) := fun z hz =>
    mem_ball_zero_iff.mpr ((hgR z (mem_ball_zero_iff.mp hz)).trans_lt hr1)
  have hgc : ∀ a z : ℂ, ‖a‖ < 1 → ‖z‖ < 1 →
      ‖mob (g a) (g z)‖ ≤ q * ‖mob a z‖ := by
    intro a z ha hz
    have hfa := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr ha))
    have hfz := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz))
    exact (scale_pick hr hr1 hq hfa hfz).trans
      (mul_le_mul_of_nonneg_left (pick hf hm ha hz) hq0)
  let u : ℕ → ℂ := fun n => g^[n] 0
  have hu : ∀ n, ‖u n‖ < 1 := by
    intro n
    exact mem_ball_zero_iff.mp (hgm.iterate n (by simp))
  have hrec : ∀ n, u (n+1) = g (u n) := fun n => iterate_succ_apply' g n 0
  have hstep : ∀ n, ‖mob (u n) (u (n+1))‖ ≤ q ^ n := by
    intro n
    induction n with
    | zero => simpa only [pow_zero] using (mob_mem (hu 0) (hu 1)).le
    | succ n ih =>
      rw [hrec n, hrec (n+1)]
      exact (hgc _ _ (hu n) (hu (n+1))).trans
        (by simpa [pow_succ, mul_comm] using mul_le_mul_of_nonneg_left ih hq0)
  have hc : CauchySeq u := SeminormedAddCommGroup.cauchySeq_of_le_geometric hq1
    (fun n => (sub_le_mob (hu n) (hu (n+1))).trans
      (mul_le_mul_of_nonneg_left (hstep n) (by norm_num)))
  obtain ⟨a, ha⟩ := cauchySeq_tendsto_of_complete hc
  have ha' : Tendsto (fun n => u (n+1)) atTop (𝓝 a) :=
    ha.comp (tendsto_add_atTop_nat 1)
  have har : ‖a‖ ≤ r := le_of_tendsto ha'.norm
    (Eventually.of_forall fun n => by rw [hrec]; exact hgR _ (hu n))
  have ha1 : ‖a‖ < 1 := har.trans_lt hr1
  refine ⟨a, ha1, ?_⟩
  have hcont : ContinuousAt g a := (hf.continuousOn.continuousAt
    (isOpen_ball.mem_nhds (mem_ball_zero_iff.mpr ha1))).const_mul _
  exact tendsto_nhds_unique (hcont.tendsto.comp ha)
    (by simpa only [hrec, Function.comp_def] using ha')

lemma weak_kernel {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {a z : ℂ}
    (ha : ‖a‖ < 1) (hz : ‖z‖ < 1) (hfa : ‖a‖ ≤ ‖f a‖) :
    Complex.normSq (1 - conj (f a) * f z) * (1 - Complex.normSq z) ≤
      Complex.normSq (1 - conj a * z) * (1 - Complex.normSq (f z)) := by
  have hn : Complex.normSq a ≤ Complex.normSq (f a) := by
    simp only [Complex.normSq_eq_norm_sq]
    exact pow_le_pow_left₀ (norm_nonneg _) hfa 2
  have hfp := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz))
  have h := pick_kernel hf hm ha hz
  have h' := mul_le_mul_of_nonneg_right
    (mul_le_mul_of_nonneg_left (sub_le_sub_left hn 1)
      (Complex.normSq_nonneg (1 - conj a * z))) (sub_pos.mpr (ns_lt hfp)).le
  have h'' := h.trans h'
  apply (mul_le_mul_iff_left₀ (sub_pos.mpr (ns_lt ha))).mp
  convert h'' using 1 <;> ring

lemma wolff_kernel {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1))
    (hfix : ∀ z ∈ ball (0 : ℂ) 1, f z ≠ z) :
    ∃ w : ℂ, ‖w‖ = 1 ∧ ∀ z : ℂ, ‖z‖ < 1 →
      Complex.normSq (1 - conj w * f z) * (1 - Complex.normSq z) ≤
      Complex.normSq (1 - conj w * z) * (1 - Complex.normSq (f z)) := by
  let r : ℕ → ℝ := fun n => 1 - (1/2)^(n+1)
  have hr : ∀ n, 0 < r n ∧ r n < 1 := by
    intro n
    have hpos : 0 < (1/2 : ℝ)^(n+1) := pow_pos (by norm_num) _
    have hlt : (1/2 : ℝ)^(n+1) < 1 := pow_lt_one₀ (by norm_num) (by norm_num) (by omega)
    constructor <;> dsimp [r] <;> linarith
  have hrL : Tendsto r atTop (𝓝 1) := by
    have hpow := tendsto_pow_atTop_nhds_zero_of_lt_one
      (by norm_num : 0 ≤ (1/2 : ℝ)) (by norm_num : (1/2 : ℝ) < 1)
    simpa [r] using tendsto_const_nhds.sub (hpow.comp (tendsto_add_atTop_nat 1))
  choose p hp using fun n => scaled_fixed hf hm (hr n).1.le (hr n).2
  obtain ⟨w, hw, φ, hφ, hpL⟩ := (isCompact_closedBall (0 : ℂ) 1).tendsto_subseq
    (fun n => mem_closedBall_zero_iff.mpr (hp n).1.le)
  have hfp : ∀ n, f (p n) = ((r n : ℝ) : ℂ)⁻¹ * p n := by
    intro n
    have hne : ((r n : ℝ) : ℂ) ≠ 0 := Complex.ofReal_ne_zero.mpr (hr n).1.ne'
    calc
      f (p n) = ((r n : ℝ) : ℂ)⁻¹ * (((r n : ℝ) : ℂ) * f (p n)) := by
        rw [← mul_assoc, inv_mul_cancel₀ hne, one_mul]
      _ = _ := by rw [(hp n).2]
  have hrCL : Tendsto (fun n => (r n : ℂ)) atTop (𝓝 (1 : ℂ)) :=
    (Complex.continuous_ofReal.tendsto 1).comp hrL
  have hfpL : Tendsto (fun n => f (p (φ n))) atTop (𝓝 w) := by
    simp_rw [hfp]
    simpa using ((hrCL.comp hφ.tendsto_atTop).inv₀ one_ne_zero).mul hpL
  have hw1 : ‖w‖ = 1 := by
    apply le_antisymm (mem_closedBall_zero_iff.mp hw)
    by_contra hn
    have hlt : ‖w‖ < 1 := lt_of_not_ge hn
    have hcont := hf.continuousOn.continuousAt
      (isOpen_ball.mem_nhds (mem_ball_zero_iff.mpr hlt))
    exact hfix w (mem_ball_zero_iff.mpr hlt)
      (tendsto_nhds_unique (hcont.tendsto.comp hpL) hfpL)
  refine ⟨w, hw1, fun z hz => ?_⟩
  have he : ∀ n, ‖p n‖ ≤ ‖f (p n)‖ := by
    intro n
    calc
      ‖p n‖ = r n * ‖f (p n)‖ := by
        calc
          ‖p n‖ = ‖((r n : ℝ) : ℂ) * f (p n)‖ := congrArg norm (hp n).2.symm
          _ = _ := by rw [norm_mul, Complex.norm_real, Real.norm_of_nonneg (hr n).1.le]
      _ ≤ ‖f (p n)‖ := by nlinarith [(hr n).2, norm_nonneg (f (p n))]
  have hineq := fun n => weak_kernel hf hm (hp (φ n)).1 hz (he (φ n))
  have hL : Tendsto (fun n => Complex.normSq (1 - conj (f (p (φ n))) * f z) *
      (1 - Complex.normSq z)) atTop
      (𝓝 (Complex.normSq (1 - conj w * f z) * (1 - Complex.normSq z))) := by
    exact ((Complex.continuous_normSq.tendsto _).comp
      (tendsto_const_nhds.sub (((Complex.continuous_conj.tendsto w).comp hfpL).mul_const _))).mul_const _
  have hR : Tendsto (fun n => Complex.normSq (1 - conj (p (φ n)) * z) *
      (1 - Complex.normSq (f z))) atTop
      (𝓝 (Complex.normSq (1 - conj w * z) * (1 - Complex.normSq (f z)))) := by
    exact ((Complex.continuous_normSq.tendsto _).comp
      (tendsto_const_nhds.sub (((Complex.continuous_conj.tendsto w).comp hpL).mul_const _))).mul_const _
  exact le_of_tendsto_of_tendsto hL hR (Eventually.of_forall hineq)

def cay (w z : ℂ) : ℂ := (1 + conj w * z) / (1 - conj w * z)

lemma bden {w z : ℂ} (hw : ‖w‖ = 1) (hz : ‖z‖ < 1) : 1 - conj w * z ≠ 0 := by
  apply sub_ne_zero.mpr
  intro h
  have hn : ‖conj w * z‖ < 1 := by simpa [norm_mul, hw] using hz
  rw [← h, norm_one] at hn
  exact lt_irrefl _ hn

lemma ns_den_pos {w z : ℂ} (hw : ‖w‖ = 1) (hz : ‖z‖ < 1) :
    0 < Complex.normSq (1 - conj w * z) := by
  rw [Complex.normSq_eq_norm_sq]
  exact sq_pos_of_pos (norm_pos_iff.mpr (bden hw hz))

lemma cay_re {w : ℂ} (hw : ‖w‖ = 1) (z : ℂ) :
    (cay w z).re = (1 - Complex.normSq z) / Complex.normSq (1 - conj w * z) := by
  have hgen : ∀ u : ℂ, ((1+u)/(1-u)).re =
      (1-Complex.normSq u)/Complex.normSq (1-u) := by
    intro u
    simp only [Complex.div_re, Complex.add_re, Complex.add_im, Complex.sub_re,
      Complex.sub_im, Complex.one_re, Complex.one_im, Complex.normSq_apply]
    ring
  rw [cay, hgen]
  have he : Complex.normSq (conj w * z) = Complex.normSq z := by
    simp only [Complex.normSq_eq_norm_sq, norm_mul, Complex.norm_conj, hw, one_mul]
  rw [he]

lemma cay_diff {w : ℂ} (hw : ‖w‖ = 1) : DifferentiableOn ℂ (cay w) (ball 0 1) := by
  apply DifferentiableOn.div
    ((differentiableOn_const 1).add ((differentiableOn_const (conj w)).mul differentiableOn_id))
    ((differentiableOn_const 1).sub ((differentiableOn_const (conj w)).mul differentiableOn_id))
  intro z hz
  exact bden hw (mem_ball_zero_iff.mp hz)

lemma cay_inj {w a z : ℂ} (hw : ‖w‖ = 1) (ha : ‖a‖ < 1) (hz : ‖z‖ < 1)
    (he : cay w a = cay w z) : a = z := by
  have he' := (div_eq_div_iff (bden hw ha) (bden hw hz)).mp he
  have hw0 : conj w ≠ 0 := by
    intro h
    have hn := congrArg norm h
    simp [hw] at hn
  have h : conj w * (a-z) = 0 := by linear_combination he' / 2
  exact sub_eq_zero.mp ((mul_eq_zero.mp h).resolve_left hw0)

lemma cay_inv {w z : ℂ} (hw : ‖w‖ = 1) (hz : ‖z‖ < 1) :
    (cay w z + 1)⁻¹ = (1 - conj w * z) / 2 := by
  have hd := bden hw hz
  have he : cay w z + 1 = 2 / (1 - conj w * z) := by
    dsimp [cay]
    apply (mul_right_injective₀ hd)
    field_simp
    ring
  rw [he, inv_div]

lemma cay_tendsto {w : ℂ} (hw : ‖w‖ = 1) {u : ℕ → ℂ}
    (hu : ∀ n, ‖u n‖ < 1)
    (hi : Tendsto (fun n => (cay w (u n) + 1)⁻¹) atTop (𝓝 0)) :
    Tendsto u atTop (𝓝 w) := by
  have hww : w * conj w = 1 := by rw [Complex.mul_conj', hw]; norm_num
  have he : ∀ n, u n = w - 2 * w * (cay w (u n) + 1)⁻¹ := by
    intro n
    rw [cay_inv hw (hu n)]
    linear_combination -(u n) * hww
  have ht := (tendsto_const_nhds (x := w)).sub (hi.const_mul (2*w))
  simpa only [mul_zero, sub_zero] using
    ht.congr' (Eventually.of_forall fun n => (he n).symm)

lemma re_min_const {g : ℂ → ℂ} (hg : DifferentiableOn ℂ g (ball 0 1))
    (hre : ∀ z ∈ ball (0 : ℂ) 1, 0 ≤ (g z).re) {a : ℂ}
    (ha : a ∈ ball (0 : ℂ) 1) (hga : (g a).re = 0) :
    ∀ z ∈ ball (0 : ℂ) 1, g z = g a := by
  rcases (hg.analyticOnNhd isOpen_ball).is_constant_or_isOpen
    (convex_ball (0 : ℂ) (1 : ℝ)).isPreconnected with ⟨c, hc⟩ | hopen
  · intro z hz
    rw [hc z hz, hc a ha]
  · have ho := hopen (ball 0 1) Subset.rfl isOpen_ball
    obtain ⟨ε, hε, hb⟩ := Metric.isOpen_iff.mp ho (g a) ⟨a, ha, rfl⟩
    have hm : g a - (ε/2 : ℝ) ∈ ball (g a) ε := by
      rw [mem_ball, dist_eq_norm]
      have he : g a - (ε/2 : ℝ) - g a = -((ε/2 : ℝ) : ℂ) := by ring
      rw [he, norm_neg, Complex.norm_real, Real.norm_of_nonneg (half_pos hε).le]
      linarith
    obtain ⟨z, hz, he⟩ := hb hm
    have hn := hre z hz
    rw [he, Complex.sub_re, Complex.ofReal_re, hga] at hn
    linarith

lemma wolff_cay {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1))
    (hfix : ∀ z ∈ ball (0 : ℂ) 1, f z ≠ z) :
    ∃ w : ℂ, ‖w‖ = 1 ∧ ∀ z : ℂ, ‖z‖ < 1 → (cay w z).re ≤ (cay w (f z)).re := by
  obtain ⟨w, hw, hk⟩ := wolff_kernel hf hm hfix
  refine ⟨w, hw, fun z hz => ?_⟩
  have hfz := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz))
  rw [cay_re hw, cay_re hw]
  apply (div_le_div_iff₀ (ns_den_pos hw hz) (ns_den_pos hw hfz)).mpr
  convert hk z hz using 1 <;> ring

lemma orbit_tendsto {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1))
    (hfix : ∀ z ∈ ball (0 : ℂ) 1, f z ≠ z) {w : ℂ} (hw : ‖w‖ = 1)
    (hj : ∀ z : ℂ, ‖z‖ < 1 → (cay w z).re ≤ (cay w (f z)).re) :
    Tendsto (fun n : ℕ => f^[n] 0) atTop (𝓝 w) := by
  let u : ℕ → ℂ := fun n => f^[n] 0
  have hu : ∀ n, ‖u n‖ < 1 := fun n =>
    mem_ball_zero_iff.mp (hm.iterate n (by simp))
  have hrec : ∀ n, u (n+1) = f (u n) := fun n => iterate_succ_apply' f n 0
  let g : ℂ → ℂ := fun z => cay w (f z) - cay w z
  have hg : DifferentiableOn ℂ g (ball 0 1) :=
    ((cay_diff hw).comp hf hm).sub (cay_diff hw)
  have hre : ∀ z ∈ ball (0 : ℂ) 1, 0 ≤ (g z).re := by
    intro z hz
    exact sub_nonneg.mpr (hj z (mem_ball_zero_iff.mp hz))
  have hmono : Monotone (fun n => (cay w (u n)).re) := by
    apply monotone_nat_of_le_succ
    intro n
    rw [hrec]
    exact hj _ (hu n)
  by_cases hex : ∃ a ∈ ball (0 : ℂ) 1, (g a).re = 0
  · obtain ⟨a, ha, hga⟩ := hex
    have hc := re_min_const hg hre ha hga
    let c := g a
    have hc0 : c ≠ 0 := by
      intro he
      have h0 := hc 0 (by simp)
      have hce : cay w (f 0) = cay w 0 := by
        change cay w (f 0) - cay w 0 = c at h0
        rw [he] at h0
        exact sub_eq_zero.mp h0
      exact hfix 0 (by simp) (cay_inj hw (mem_ball_zero_iff.mp (hm (by simp))) (by simp) hce)
    have hform : ∀ n, cay w (u n) = 1 + (n : ℂ) * c := by
      intro n
      induction n with
      | zero => simp [u, cay]
      | succ n ih =>
        have hcn := hc (u n) (mem_ball_zero_iff.mpr (hu n))
        change cay w (f (u n)) - cay w (u n) = c at hcn
        rw [hrec]
        push_cast
        linear_combination hcn + ih
    have ht : Tendsto (fun n : ℕ => (n : ℂ) * c + 2) atTop (Bornology.cobounded ℂ) :=
      (tendsto_add_const_cobounded (2 : ℂ)).comp
        ((tendsto_mul_right_cobounded hc0).comp tendsto_natCast_atTop_cobounded)
    have hi := tendsto_inv₀_cobounded.comp ht
    apply cay_tendsto hw hu
    convert hi using 1
    funext n
    rw [hform]
    congr 1
    ring
  · apply (isCompact_closedBall (0 : ℂ) 1).tendsto_nhds_of_unique_mapClusterPt
      (Eventually.of_forall fun n => mem_closedBall_zero_iff.mpr (hu n).le)
    intro a ha hcl
    obtain ⟨φ, hφ, hlim⟩ := hcl.tendsto_subseq
    by_cases hai : ‖a‖ < 1
    · have hcont := (cay_diff hw).continuousOn.continuousAt
        (isOpen_ball.mem_nhds (mem_ball_zero_iff.mpr hai))
      have hJLsub : Tendsto (fun n => (cay w (u (φ n))).re) atTop (𝓝 (cay w a).re) :=
        Complex.continuous_re.continuousAt.tendsto.comp (hcont.tendsto.comp hlim)
      have hJL := (tendsto_iff_tendsto_subseq_of_monotone hmono hφ.tendsto_atTop).mpr hJLsub
      have hJL' := hJL.comp (tendsto_add_atTop_nat 1)
      have hGlim : Tendsto (fun n => (g (u (φ n))).re) atTop (𝓝 0) := by
        simpa only [Function.comp_def, g, Complex.sub_re, hrec, sub_self] using
          (hJL'.sub hJL).comp hφ.tendsto_atTop
      have hgc := hg.continuousOn.continuousAt
        (isOpen_ball.mem_nhds (mem_ball_zero_iff.mpr hai))
      have hga : (g a).re = 0 := tendsto_nhds_unique
        (Complex.continuous_re.continuousAt.tendsto.comp (hgc.tendsto.comp hlim)) hGlim
      exact (hex ⟨a, mem_ball_zero_iff.mpr hai, hga⟩).elim
    · have ha1 : ‖a‖ = 1 := le_antisymm (mem_closedBall_zero_iff.mp ha) (le_of_not_gt hai)
      have hbound : ∀ n, Complex.normSq (1 - conj w * u n) ≤ 1 - Complex.normSq (u n) := by
        intro n
        have hjn : 1 ≤ (cay w (u n)).re := by
          have h := hmono (Nat.zero_le n)
          simpa [u, cay] using h
        rw [cay_re hw] at hjn
        simpa only [one_mul] using (le_div_iff₀ (ns_den_pos hw (hu n))).mp hjn
      have hL := (Complex.continuous_normSq.tendsto (1 - conj w * a)).comp
        (tendsto_const_nhds.sub (hlim.const_mul (conj w)))
      have hR := (tendsto_const_nhds (x := (1 : ℝ))).sub
        ((Complex.continuous_normSq.tendsto a).comp hlim)
      have hle := le_of_tendsto_of_tendsto hL hR
        (Eventually.of_forall fun n => hbound (φ n))
      have hns : Complex.normSq a = 1 := by rw [Complex.normSq_eq_norm_sq, ha1]; norm_num
      rw [hns, sub_self] at hle
      have he : 1 - conj w * a = 0 := by
        rw [Complex.normSq_eq_norm_sq] at hle
        exact norm_eq_zero.mp (by nlinarith [norm_nonneg (1-conj w*a)])
      have hww : conj w * w = 1 := by rw [Complex.conj_mul', hw]; norm_num
      have hw0 : conj w ≠ 0 := by
        intro h
        simpa [h] using hww
      apply mul_left_cancel₀ hw0
      rw [hww]
      exact (sub_eq_zero.mp he).symm

lemma difference_bound {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {r : ℝ} (hr : 0 ≤ r) (hr1 : r < 1)
    {z : ℂ} (hz : ‖z‖ ≤ r) :
    ‖f 0 - f z‖ ≤ r * (1 - ‖f 0‖^2) / (1-r) := by
  have hz1 := hz.trans_lt hr1
  have ha : ‖f 0‖ < 1 := mem_ball_zero_iff.mp (hm (by simp))
  have hb : ‖f z‖ < 1 := mem_ball_zero_iff.mp (hm (mem_ball_zero_iff.mpr hz1))
  have hB : 0 ≤ 1 - ‖f 0‖^2 := by nlinarith [norm_nonneg (f 0)]
  have hfirst : ‖1 - conj (f 0) * f 0‖ = 1 - ‖f 0‖^2 := by
    rw [Complex.conj_mul', ← Complex.ofReal_pow, ← Complex.ofReal_one, ← Complex.ofReal_sub,
      Complex.norm_real, Real.norm_of_nonneg hB]
  have hden : ‖1 - conj (f 0) * f z‖ ≤ (1 - ‖f 0‖^2) + ‖f 0 - f z‖ := by
    have he : 1 - conj (f 0) * f z =
        (1 - conj (f 0) * f 0) + conj (f 0) * (f 0 - f z) := by ring
    rw [he]
    calc
      _ ≤ ‖1 - conj (f 0) * f 0‖ + ‖conj (f 0) * (f 0 - f z)‖ := norm_add_le _ _
      _ ≤ _ := by rw [hfirst, norm_mul, Complex.norm_conj]; nlinarith [norm_nonneg (f 0-f z)]
  have hp := pick hf hm (by simp : ‖(0 : ℂ)‖ < 1) hz1
  have hp' : ‖f 0 - f z‖ / ‖1 - conj (f 0) * f z‖ ≤ ‖z‖ := by
    simpa [mob, norm_div] using hp
  have hN := (div_le_iff₀ (norm_pos_iff.mpr (den_ne ha hb))).mp hp'
  have hN' := hN.trans (mul_le_mul_of_nonneg_right hz (norm_nonneg _))
  have hN'' := hN'.trans (mul_le_mul_of_nonneg_left hden hr)
  apply (le_div_iff₀ (sub_pos.mpr hr1)).mpr
  nlinarith only [hN'']

lemma local_of_zero {f : ℂ → ℂ} (hf : DifferentiableOn ℂ f (ball 0 1))
    (hm : MapsTo f (ball 0 1) (ball 0 1)) {w : ℂ} (hw : ‖w‖ = 1)
    (hzero : Tendsto (fun n : ℕ => f^[n] 0) atTop (𝓝 w)) :
    TendstoLocallyUniformlyOn (fun n : ℕ => f^[n]) (fun _ => w) atTop (ball 0 1) := by
  apply Metric.tendstoLocallyUniformlyOn_iff.mpr
  intro ε hε x hx
  have hx1 : ‖x‖ < 1 := mem_ball_zero_iff.mp hx
  let r : ℝ := (1 + ‖x‖)/2
  have hr : 0 ≤ r := by dsimp [r]; positivity
  have hr1 : r < 1 := by dsimp [r]; linarith
  have hxr : ‖x‖ < r := by dsimp [r]; linarith
  refine ⟨ball 0 r, mem_nhdsWithin_of_mem_nhds (isOpen_ball.mem_nhds
    (mem_ball_zero_iff.mpr hxr)), ?_⟩
  have hB : Tendsto (fun n : ℕ => 1 - ‖f^[n] 0‖^2) atTop (𝓝 0) := by
    simpa [hw] using (tendsto_const_nhds (x := (1 : ℝ))).sub (hzero.norm.pow 2)
  have hE : Tendsto (fun n : ℕ => dist w (f^[n] 0) + r * (1-‖f^[n] 0‖^2)/(1-r))
      atTop (𝓝 0) := by
    simpa using ((tendsto_const_nhds (x := w)).dist hzero).add ((hB.const_mul r).div_const (1-r))
  filter_upwards [hE.eventually (gt_mem_nhds hε)] with n hn
  intro y hy
  have hbound := difference_bound (hf.iterate hm n) (hm.iterate n) hr hr1
    (mem_ball_zero_iff.mp hy).le
  calc
    dist w (f^[n] y) ≤ dist w (f^[n] 0) + dist (f^[n] 0) (f^[n] y) := dist_triangle _ _ _
    _ ≤ dist w (f^[n] 0) + r * (1 - ‖f^[n] 0‖^2)/(1-r) := by
      exact add_le_add le_rfl (by simpa [dist_eq_norm] using hbound)
    _ < ε := hn

end DW

theorem problem5 (f : ℂ → ℂ)
    (hf : DifferentiableOn ℂ f (Metric.ball 0 1))
    (hm : Set.MapsTo f (Metric.ball 0 1) (Metric.ball 0 1))
    (hfix : ∀ z ∈ Metric.ball (0 : ℂ) 1, f z ≠ z) :
    ∃ w : ℂ, ‖w‖ = 1 ∧
      TendstoLocallyUniformlyOn (fun n : ℕ => f^[n]) (fun _ => w)
        Filter.atTop (Metric.ball 0 1) := by
  obtain ⟨w, hw, hj⟩ := DW.wolff_cay hf hm hfix
  exact ⟨w, hw, DW.local_of_zero hf hm hw (DW.orbit_tendsto hf hm hfix hw hj)⟩
