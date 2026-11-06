import Mathlib.LinearAlgebra.Matrix.Rank
import Mathlib.LinearAlgebra.Matrix.SchurComplement
import Mathlib.LinearAlgebra.BilinearForm.Orthogonal
import Mathlib.Topology.Instances.Matrix
import Mathlib.Analysis.Complex.Basic
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.NormNum
import Mathlib.Tactic.Ring
import Mathlib.Tactic.FunProp

open Matrix Module Filter
open scoped Topology

private lemma schur_zero_of_rank {u v : Type*} [Fintype u] [Fintype v]
    [DecidableEq u] [DecidableEq v]
    (A : Matrix u u ℂ) (B : Matrix u v ℂ) (C : Matrix v u ℂ) (D : Matrix v v ℂ)
    (hA : IsUnit A.det) (hM : (fromBlocks A B C D).rank ≤ Fintype.card u) :
    D = C * A⁻¹ * B := by
  classical
  letI := Matrix.invertibleOfIsUnitDet A hA
  ext i j
  let row : u ⊕ Unit → u ⊕ v := Sum.map id (fun _ => i)
  let col : u ⊕ Unit → u ⊕ v := Sum.map id (fun _ => j)
  let M := (fromBlocks A B C D).submatrix row col
  have hr : M.rank ≤ Fintype.card u :=
    (rank_submatrix_le _ row col).trans hM
  have hd : M.det = 0 := by
    by_contra hne
    have he := rank_of_det_ne_zero hne
    simp only [Fintype.card_sum, Fintype.card_unit] at he
    omega
  have he : M = fromBlocks A (B.submatrix id (fun _ : Unit => j))
      (C.submatrix (fun _ : Unit => i) id) (D.submatrix (fun _ : Unit => i) (fun _ : Unit => j)) := by
    ext x y
    cases x <;> cases y <;> rfl
  rw [he, det_fromBlocks₁₁] at hd
  have hAi : A.det ≠ 0 := hA.ne_zero
  rw [mul_eq_zero] at hd
  have hzero := hd.resolve_left hAi
  rw [det_unique] at hzero
  simp only [Matrix.sub_apply, submatrix_apply, id_eq, invOf_eq_nonsing_inv] at hzero
  have hm : ((C.submatrix (fun _ : Unit => i) id) * A⁻¹ *
      B.submatrix id (fun _ : Unit => j)) () () = (C * A⁻¹ * B) i j := by
    simp only [mul_apply, submatrix_apply, id_eq]
  exact sub_eq_zero.mp (hm ▸ hzero)

private lemma rank_tangent_constraints {u v : Type*} [Fintype u] [Fintype v]
    [DecidableEq u] [DecidableEq v]
    (A : Matrix u u ℂ) (B : Matrix u v ℂ) (C : Matrix v u ℂ) (D : Matrix v v ℂ)
    (hr : ∀ t : ℂ, (fromBlocks (1 + t • A) (t • B) (t • C) (t • D)).rank ≤ Fintype.card u) :
    D = 0 ∧ C * B = 0 := by
  classical
  let F : ℂ → Matrix v v ℂ := fun t => C * (1 + t • A)⁻¹ * B
  have hp : ContinuousAt (fun t : ℂ => (1 : Matrix u u ℂ) + t • A) 0 := by fun_prop
  have hinv : ContinuousAt (Inv.inv : Matrix u u ℂ → Matrix u u ℂ) 1 :=
    continuousAt_matrix_inv _ (by
      simpa only [det_one, Ring.inverse_eq_inv'] using (continuousAt_inv₀ (show (1 : ℂ) ≠ 0 by norm_num)))
  have hF : ContinuousAt F 0 := by
    have hcomp := hinv.comp_of_eq hp (by simp)
    have hc : Continuous (fun E : Matrix u u ℂ => C * E * B) := by fun_prop
    exact hc.continuousAt.comp hcomp
  have hunit : ∀ᶠ t : ℂ in 𝓝 0, ((1 : Matrix u u ℂ) + t • A).det ≠ 0 :=
    (continuous_id.matrix_det.continuousAt.comp hp).eventually_ne (by simp)
  have he : ∀ᶠ t : ℂ in 𝓝[≠] 0, D = t • F t := by
    filter_upwards [hunit.filter_mono nhdsWithin_le_nhds, self_mem_nhdsWithin] with t ht ht0
    have htne : t ≠ 0 := ht0
    have h := schur_zero_of_rank (1 + t • A) (t • B) (t • C) (t • D)
      (IsUnit.mk0 _ ht) (hr t)
    apply smul_right_injective (Matrix v v ℂ) htne
    simpa only [Matrix.smul_mul, Matrix.mul_smul, smul_smul, F] using h
  have hd : D = 0 := by
    have hl : Tendsto (fun t : ℂ => t • F t) (𝓝[≠] 0) (𝓝 (0 : Matrix v v ℂ)) := by
      have hh : ContinuousAt (fun t : ℂ => t • F t) 0 := by fun_prop
      simpa only [zero_smul] using hh.tendsto.mono_left nhdsWithin_le_nhds
    exact tendsto_nhds_unique tendsto_const_nhds
      (hl.congr' (show (fun t => t • F t) =ᶠ[𝓝[≠] 0] (fun _ => D) from he.mono (fun _ h => h.symm)))
  have he0 : ∀ᶠ t : ℂ in 𝓝[≠] 0, F t = 0 := by
    filter_upwards [he, self_mem_nhdsWithin] with t ht ht0
    have htne : t ≠ 0 := ht0
    rw [hd] at ht
    exact (smul_eq_zero.mp ht.symm).resolve_left htne
  have hc : C * B = 0 := by
    have hl : Tendsto F (𝓝[≠] 0) (𝓝 (C * B)) := by
      simpa [F] using hF.tendsto.mono_left nhdsWithin_le_nhds
    exact tendsto_nhds_unique (hl.congr' he0) tendsto_const_nhds
  exact ⟨hd, hc⟩
