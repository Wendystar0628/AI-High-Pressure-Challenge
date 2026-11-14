import Mathlib.Basic.Complex.Basic
import Mathlib.Algebra.Group.Invertible.Basic
import Mathlib.Algebra.Polynomial.Roots
import Mathlib.LinearAlgebra.Matrix.FiniteDimensional
import Mathlib.LinearAlgebra.Matrix.Rank
import Mathlib.LinearAlgebra.Matrix.SchurComplement
import Mathlib.LinearAlgebra.Matrix.Trace

section Problem6Aux

open Polynomial Matrix

private lemma poly_eq_zero_of_forall_eval_zero (F : ℂ[X]) (h : ∀ s : ℂ, F.eval s = 0) :
    F = 0 := by
  classical
  by_contra hF
  let S : Finset ℂ := (Finset.range (F.natDegree + 1)).image (Nat.cast : ℕ → ℂ)
  have hcard : S.card = F.natDegree + 1 := by
    rw [Finset.card_image_of_injective _ Nat.cast_injective, Finset.card_range]
  have hsub : S ⊆ F.roots.toFinset := by
    intro z hz
    rw [Multiset.mem_toFinset, Polynomial.mem_roots hF, Polynomial.IsRoot]
    exact h z
  have h1 : S.card ≤ F.roots.toFinset.card := Finset.card_le_card hsub
  have h2 : F.roots.toFinset.card ≤ Multiset.card F.roots := Multiset.toFinset_card_le _
  have h3 : Multiset.card F.roots ≤ F.natDegree := Polynomial.card_roots' F
  omega

private lemma poly_eq_zero_of_off_roots (d q : ℂ[X]) (hd : d.eval 0 ≠ 0)
    (hq : ∀ s : ℂ, s ≠ 0 → d.eval s ≠ 0 → q.eval s = 0) : q = 0 := by
  have hd0 : d ≠ 0 := fun h => hd (by simp [h])
  have hX0 : (Polynomial.X : ℂ[X]) ≠ 0 := Polynomial.X_ne_zero
  have hF : Polynomial.X * d * q = 0 := by
    refine poly_eq_zero_of_forall_eval_zero _ fun s => ?_
    simp only [Polynomial.eval_mul, Polynomial.eval_X]
    by_cases hs : s = 0
    · simp [hs]
    · by_cases hds : d.eval s = 0
      · simp [hds]
      · rw [hq s hs hds, mul_zero]
  rcases mul_eq_zero.mp hF with hXd | hq0
  · rcases mul_eq_zero.mp hXd with hX | hd'
    · exact False.elim (hX0 hX)
    · exact False.elim (hd0 hd')
  · exact hq0

private noncomputable def Ppoly {p : ℕ} (A : Matrix (Fin p) (Fin p) ℂ) :
    Matrix (Fin p) (Fin p) ℂ[X] :=
  1 + (Polynomial.X : ℂ[X]) • A.map Polynomial.C

private lemma evalRingHom_mapMatrix_const {p : ℕ} (s : ℂ) (M : Matrix (Fin p) (Fin p) ℂ) :
    (Polynomial.evalRingHom s).mapMatrix (M.map Polynomial.C) = M := by
  ext i j
  simp

private lemma evalRingHom_mapMatrix_Ppoly {p : ℕ} (s : ℂ) (A : Matrix (Fin p) (Fin p) ℂ) :
    (Polynomial.evalRingHom s).mapMatrix (Ppoly A) = 1 + s • A := by
  ext i j
  by_cases hij : i = j <;> simp [Ppoly, hij] <;> ring

private lemma det_Ppoly_eval {p : ℕ} (s : ℂ) (A : Matrix (Fin p) (Fin p) ℂ) :
    (Ppoly A).det.eval s = (1 + s • A).det := by
  change Polynomial.evalRingHom s (Ppoly A).det = (1 + s • A).det
  rw [RingHom.map_det, evalRingHom_mapMatrix_Ppoly]

private lemma sandwich_poly_eval {p q : ℕ} (s : ℂ)
    (C : Matrix (Fin q) (Fin p) ℂ) (K : Matrix (Fin p) (Fin p) ℂ[X])
    (B : Matrix (Fin p) (Fin q) ℂ) (i j : Fin q) :
    ((C.map Polynomial.C * K * B.map Polynomial.C) i j).eval s =
      (C * ((Polynomial.evalRingHom s).mapMatrix K) * B) i j := by
  simp only [Matrix.mul_apply, Matrix.map_apply, RingHom.mapMatrix_apply,
    Polynomial.eval_finsetSum, Polynomial.eval_mul, Polynomial.eval_C,
    Polynomial.coe_evalRingHom]

private lemma eq_zero_of_rank_fromBlocks_le {p q : ℕ}
    (P : Matrix (Fin p) (Fin p) ℂ) (Q : Matrix (Fin q) (Fin q) ℂ)
    (hP : P.det ≠ 0) (hrank : (Matrix.fromBlocks P 0 0 Q).rank ≤ p) :
    Q = 0 := by
  have hPdet : IsUnit P.det := hP.isUnit
  have hmul : Matrix.fromBlocks P⁻¹ (0 : Matrix (Fin p) (Fin q) ℂ)
      (0 : Matrix (Fin q) (Fin p) ℂ) (1 : Matrix (Fin q) (Fin q) ℂ) *
      Matrix.fromBlocks P 0 0 Q =
      Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 Q := by
    rw [Matrix.fromBlocks_multiply]
    simp [Matrix.nonsing_inv_mul P hPdet]
  have hrank1 : (Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 Q).rank ≤ p := by
    rw [← hmul]
    exact (Matrix.rank_mul_le_right _ _).trans hrank
  by_contra hQ
  have hex : ∃ i₀ j₀ : Fin q, Q i₀ j₀ ≠ 0 := by
    by_contra! hall
    exact hQ (Matrix.ext hall)
  obtain ⟨i₀, j₀, hij⟩ := hex
  let g : Fin p ⊕ Unit → Fin p ⊕ Fin q := Sum.map id (fun _ => i₀)
  let f : Fin p ⊕ Unit → Fin p ⊕ Fin q := Sum.map id (fun _ => j₀)
  let N := (Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 Q).submatrix g f
  have hN_eq : N = Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0
      (Matrix.of fun _ _ : Unit => Q i₀ j₀) := by
    ext (i | i) (j | j) <;> simp [N, g, f]
  have hN_det : N.det ≠ 0 := by
    rw [hN_eq, Matrix.det_fromBlocks_zero₂₁, Matrix.det_one, one_mul, Matrix.det_unique]
    exact hij
  have hN_rank : N.rank = p + 1 := by
    rw [Matrix.rank_of_det_ne_zero hN_det, Fintype.card_sum, Fintype.card_fin, Fintype.card_unit]
  have hle : N.rank ≤ (Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 Q).rank :=
    Matrix.rank_submatrix_le _ g f
  omega

private lemma schur_eq_zero_of_rank_le {p q : ℕ}
    (A : Matrix (Fin p) (Fin p) ℂ) (B : Matrix (Fin p) (Fin q) ℂ)
    (C : Matrix (Fin q) (Fin p) ℂ) (D : Matrix (Fin q) (Fin q) ℂ)
    (s : ℂ) (hdet : (1 + s • A).det ≠ 0)
    (hrank : (Matrix.fromBlocks (1 + s • A) (s • B) (s • C) (s • D)).rank ≤ p) :
    (1 + s • A).det • (s • D) = (s * s) • (C * (1 + s • A).adjugate * B) := by
  let P := 1 + s • A
  have hPunit : IsUnit P := (Matrix.isUnit_iff_isUnit_det P).mpr hdet.isUnit
  obtain ⟨invP⟩ := hPunit.nonempty_invertible
  let Q := s • D - (s • C) * ⅟P * (s • B)
  let L : Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ :=
    Matrix.fromBlocks 1 0 ((s • C) * ⅟P) 1
  let R : Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ :=
    Matrix.fromBlocks 1 (⅟P * (s • B)) 0 1
  have hdecomp : Matrix.fromBlocks P (s • B) (s • C) (s • D) =
      L * Matrix.fromBlocks P 0 0 Q * R :=
    Matrix.fromBlocks_eq_of_invertible₁₁ P (s • B) (s • C) (s • D)
  have hLunit : IsUnit L.det :=
    (Matrix.isUnit_iff_isUnit_det L).mp (Matrix.isUnit_fromBlocks_zero₁₂.mpr ⟨isUnit_one, isUnit_one⟩)
  have hRunit : IsUnit R.det :=
    (Matrix.isUnit_iff_isUnit_det R).mp (Matrix.isUnit_fromBlocks_zero₂₁.mpr ⟨isUnit_one, isUnit_one⟩)
  have hQrank : (Matrix.fromBlocks P 0 0 Q).rank ≤ p := by
    have hr1 : (L * Matrix.fromBlocks P 0 0 Q * R).rank ≤ p := hdecomp ▸ hrank
    rwa [Matrix.rank_mul_eq_left_of_isUnit_det R _ hRunit,
      Matrix.rank_mul_eq_right_of_isUnit_det L _ hLunit] at hr1
  have hQ0 : Q = 0 := eq_zero_of_rank_fromBlocks_le P Q hdet hQrank
  have hsD : s • D = (s • C) * ⅟P * (s • B) := sub_eq_zero.mp hQ0
  have hadj : P.det • (⅟P : Matrix (Fin p) (Fin p) ℂ) = P.adjugate := by
    have h1 : P * (P.det • (⅟P : Matrix (Fin p) (Fin p) ℂ)) = P * P.adjugate := by
      rw [Matrix.mul_smul, mul_invOf_self, Matrix.mul_adjugate]
    have h2 := congrArg ((⅟P : Matrix (Fin p) (Fin p) ℂ) * ·) h1
    simpa [Matrix.invOf_mul_cancel_left] using h2
  rw [hsD]
  calc P.det • ((s • C) * ⅟P * (s • B))
      = P.det • ((s * s) • (C * ⅟P * B)) := by
        simp [Matrix.smul_mul, Matrix.mul_smul, smul_smul, mul_comm]
    _ = (s * s) • (C * (P.det • ⅟P) * B) := by
        simp [Matrix.smul_mul, Matrix.mul_smul, smul_smul, mul_comm]
    _ = (s * s) • (C * P.adjugate * B) := by rw [hadj]

private lemma block_identities_of_mem {p q : ℕ}
    (S' : Submodule ℂ (Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ))
    (hM₀ : Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 0 ∈ S')
    (hrank : ∀ M ∈ S', M.rank ≤ p)
    (M : Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ) (hM : M ∈ S') :
    M.toBlocks₂₂ = 0 ∧ M.toBlocks₂₁ * M.toBlocks₁₂ = 0 ∧
      M.toBlocks₂₁ * M.toBlocks₁₁ * M.toBlocks₁₂ = 0 := by
  set A := M.toBlocks₁₁
  set B := M.toBlocks₁₂
  set C := M.toBlocks₂₁
  set D := M.toBlocks₂₂
  have hM_eq : Matrix.fromBlocks A B C D = M := Matrix.fromBlocks_toBlocks M
  have hcomb : ∀ s : ℂ,
      Matrix.fromBlocks (1 + s • A) (s • B) (s • C) (s • D) ∈ S' := by
    intro s
    have hmem : Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 0 + s • M ∈ S' :=
      S'.add_mem hM₀ (S'.smul_mem s hM)
    rw [← hM_eq, Matrix.fromBlocks_smul, Matrix.fromBlocks_add] at hmem
    simpa using hmem
  have hrel1 : ∀ s : ℂ, s ≠ 0 → (1 + s • A).det ≠ 0 →
      (1 + s • A).det • D = s • (C * (1 + s • A).adjugate * B) := by
    intro s hs hdet
    have hschur := schur_eq_zero_of_rank_le A B C D s hdet (hrank _ (hcomb s))
    have hschur' : s • ((1 + s • A).det • D) = s • (s • (C * (1 + s • A).adjugate * B)) := by
      simpa [smul_smul, mul_comm] using hschur
    exact smul_right_inj hs |>.mp hschur'
  let d : ℂ[X] := (Ppoly A).det
  have hd0 : d.eval 0 ≠ 0 := by
    rw [det_Ppoly_eval]
    simp
  let Rpoly : Matrix (Fin q) (Fin q) ℂ[X] :=
    C.map Polynomial.C * (Ppoly A).adjugate * B.map Polynomial.C
  have hRpoly_eval : ∀ s : ℂ, ∀ i j : Fin q,
      (Rpoly i j).eval s = (C * (1 + s • A).adjugate * B) i j := by
    intro s i j
    rw [sandwich_poly_eval, RingHom.map_adjugate, evalRingHom_mapMatrix_Ppoly]
  have hq1_zero : ∀ i j : Fin q,
      d * Polynomial.C (D i j) - Polynomial.X * Rpoly i j = 0 := by
    intro i j
    refine poly_eq_zero_of_off_roots d _ hd0 fun s hs hds => ?_
    rw [det_Ppoly_eval] at hds
    have heq := congrFun (congrFun (hrel1 s hs hds) i) j
    simp only [Polynomial.eval_sub, Polynomial.eval_mul, Polynomial.eval_C, Polynomial.eval_X,
      d, det_Ppoly_eval, hRpoly_eval]
    exact sub_eq_zero.mpr heq
  have hD0 : D = 0 := by
    ext i j
    have h0 := congrArg (Polynomial.eval 0) (hq1_zero i j)
    simpa [d, det_Ppoly_eval] using h0
  have hRpoly_zero : ∀ s : ℂ, C * (1 + s • A).adjugate * B = 0 := by
    intro s
    ext i j
    have hq := hq1_zero i j
    rw [hD0, Matrix.zero_apply, map_zero, mul_zero, zero_sub, neg_eq_zero] at hq
    have hrij : Rpoly i j = 0 :=
      (mul_eq_zero.mp hq).resolve_left Polynomial.X_ne_zero
    rw [← hRpoly_eval s i j, hrij]
    simp
  have hCB0 : C * B = 0 := by
    simpa using hRpoly_zero 0
  have hrel2 : ∀ s : ℂ, s ≠ 0 →
      (1 + s • A).det • (C * A * B) = s • (C * (1 + s • A).adjugate * (A * A) * B) := by
    intro s hs
    let P := 1 + s • A
    let N := 1 - s • A
    have hPN : P * N = 1 - (s * s) • (A * A) := by
      dsimp only [P, N]
      rw [Matrix.mul_sub, Matrix.mul_one, Matrix.add_mul, Matrix.one_mul,
        Matrix.smul_mul, Matrix.mul_smul, smul_smul]
      abel
    have hw1 : C * (P.adjugate * (P * N)) * B = -(s • (P.det • (C * A * B))) := by
      have hadjP : P.adjugate * (P * N) = P.det • (1 - s • A) := by
        rw [← Matrix.mul_assoc, Matrix.adjugate_mul, Matrix.smul_mul, Matrix.one_mul]
      rw [hadjP, Matrix.mul_smul, Matrix.smul_mul, Matrix.mul_sub, Matrix.mul_one,
        Matrix.sub_mul, hCB0, zero_sub, Matrix.mul_smul, Matrix.smul_mul, smul_neg,
        smul_comm P.det s]
    have hw2 : C * (P.adjugate * (P * N)) * B =
        -(s • (s • (C * P.adjugate * (A * A) * B))) := by
      rw [hPN, Matrix.mul_sub, Matrix.mul_one, Matrix.mul_sub, Matrix.sub_mul,
        hRpoly_zero s, zero_sub]
      simp [Matrix.mul_smul, Matrix.smul_mul, smul_smul, Matrix.mul_assoc]
    have heq : -(s • (P.det • (C * A * B))) = -(s • (s • (C * P.adjugate * (A * A) * B))) :=
      hw1.symm.trans hw2
    exact smul_right_inj hs |>.mp (neg_inj.mp heq)
  let Rpoly2 : Matrix (Fin q) (Fin q) ℂ[X] :=
    C.map Polynomial.C * ((Ppoly A).adjugate * (A * A).map Polynomial.C) * B.map Polynomial.C
  have hRpoly2_eval : ∀ s : ℂ, ∀ i j : Fin q,
      (Rpoly2 i j).eval s = (C * (1 + s • A).adjugate * (A * A) * B) i j := by
    intro s i j
    rw [sandwich_poly_eval, map_mul, RingHom.map_adjugate, evalRingHom_mapMatrix_Ppoly,
      evalRingHom_mapMatrix_const]
    simp only [Matrix.mul_assoc]
  have hCAB0 : C * A * B = 0 := by
    ext i j
    have hq2_zero : d * Polynomial.C ((C * A * B) i j) - Polynomial.X * Rpoly2 i j = 0 := by
      refine poly_eq_zero_of_off_roots d _ hd0 fun s hs _ => ?_
      have heq := congrFun (congrFun (hrel2 s hs) i) j
      simp only [Polynomial.eval_sub, Polynomial.eval_mul, Polynomial.eval_C, Polynomial.eval_X,
        d, det_Ppoly_eval, hRpoly2_eval]
      exact sub_eq_zero.mpr heq
    have h0 := congrArg (Polynomial.eval 0) hq2_zero
    simpa [d, det_Ppoly_eval] using h0
  exact ⟨hD0, hCB0, hCAB0⟩

private lemma trace_single_mul {p q : ℕ} (j : Fin q) (i : Fin p)
    (B₀ : Matrix (Fin p) (Fin q) ℂ) :
    Matrix.trace (Matrix.single j i (1 : ℂ) * B₀) = B₀ i j := by
  rw [Matrix.trace]
  simp only [Matrix.diag_apply, Matrix.mul_apply]
  rw [Fintype.sum_eq_single j]
  · rw [Fintype.sum_eq_single i]
    · simp
    · intro l hl
      simp [hl.symm]
  · intro k hk
    refine Finset.sum_eq_zero fun l _ => ?_
    simp [hk.symm]

private lemma trace_mul_single {p q : ℕ} (C₀ : Matrix (Fin q) (Fin p) ℂ)
    (j : Fin p) (i : Fin q) :
    Matrix.trace (C₀ * Matrix.single j i (1 : ℂ)) = C₀ i j := by
  rw [Matrix.trace]
  simp only [Matrix.diag_apply, Matrix.mul_apply]
  rw [Fintype.sum_eq_single i]
  · rw [Fintype.sum_eq_single j]
    · simp
    · intro l hl
      simp [hl.symm]
  · intro k hk
    refine Finset.sum_eq_zero fun l _ => ?_
    simp [hk.symm]

private lemma isotropic_finrank_le {p q : ℕ}
    (W : Submodule ℂ (Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ))
    (hiso : ∀ x ∈ W, ∀ y ∈ W, x.2 * y.1 + y.2 * x.1 = 0) :
    Module.finrank ℂ W ≤ p * q := by
  let B : (Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ) →ₗ[ℂ]
      (Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ) →ₗ[ℂ] ℂ :=
    { toFun := fun x =>
        { toFun := fun y => Matrix.trace (x.2 * y.1 + y.2 * x.1)
          map_add' := fun y₁ y₂ => by
            simp only [Prod.fst_add, Prod.snd_add, Matrix.mul_add, Matrix.add_mul, Matrix.trace_add]
            abel
          map_smul' := fun c y => by
            simp only [Prod.smul_fst, Prod.smul_snd, Matrix.mul_smul, Matrix.smul_mul,
              Matrix.trace_add, Matrix.trace_smul, RingHom.id_apply, smul_eq_mul]
            ring }
      map_add' := fun x₁ x₂ => LinearMap.ext fun y => by
        simp only [LinearMap.add_apply, LinearMap.coe_mk, AddHom.coe_mk,
          Prod.fst_add, Prod.snd_add, Matrix.mul_add, Matrix.add_mul, Matrix.trace_add]
        abel
      map_smul' := fun c x => LinearMap.ext fun y => by
        simp only [LinearMap.smul_apply, LinearMap.coe_mk, AddHom.coe_mk,
          Prod.smul_fst, Prod.smul_snd, Matrix.mul_smul, Matrix.smul_mul,
          Matrix.trace_add, Matrix.trace_smul, RingHom.id_apply, smul_eq_mul]
        ring }
  have hB_flip : B.flip = B :=
    LinearMap.ext fun x => LinearMap.ext fun y => by
      dsimp [B]
      rw [add_comm]
  have hB_inj : Function.Injective B := by
    rw [← LinearMap.ker_eq_bot, Submodule.eq_bot_iff]
    rintro ⟨B₀, C₀⟩ hx
    rw [LinearMap.mem_ker] at hx
    have hB0 : B₀ = 0 := by
      ext i j
      have hy := congrFun (congrArg DFunLike.coe hx) (0, Matrix.single j i (1 : ℂ))
      simpa [B, trace_single_mul] using hy
    have hC0 : C₀ = 0 := by
      ext i j
      have hy := congrFun (congrArg DFunLike.coe hx) (Matrix.single j i (1 : ℂ), 0)
      simpa [B, trace_mul_single] using hy
    exact Prod.ext hB0 hC0
  have hB_surj : Function.Surjective B := by
    have h := LinearMap.flip_surjective_iff₁ (B := B).mpr hB_inj
    rwa [hB_flip] at h
  let H : (Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ) →ₗ[ℂ] Module.Dual ℂ W :=
    W.subtype.dualMap.comp B
  have hH_surj : Function.Surjective H :=
    (LinearMap.dualMap_surjective_of_injective W.injective_subtype).comp hB_surj
  have hH_range : Module.finrank ℂ (LinearMap.range H) = Module.finrank ℂ W := by
    rw [LinearMap.range_eq_top.mpr hH_surj, finrank_top, Subspace.dual_finrank_eq]
  have hW_le_ker : W ≤ LinearMap.ker H := by
    intro x hx
    rw [LinearMap.mem_ker]
    ext ⟨y, hy⟩
    change Matrix.trace (x.2 * y.1 + y.2 * x.1) = 0
    rw [hiso x hx y hy, Matrix.trace_zero]
  have hW_le_finrank : Module.finrank ℂ W ≤ Module.finrank ℂ (LinearMap.ker H) :=
    Submodule.finrank_mono hW_le_ker
  have hE_finrank :
      Module.finrank ℂ (Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ) = 2 * (p * q) := by
    rw [Module.finrank_prod, Module.finrank_matrix, Module.finrank_matrix,
      Fintype.card_fin, Fintype.card_fin, CommSemiring.finrank_self]
    ring
  have hrn := LinearMap.finrank_range_add_finrank_ker H
  rw [hH_range, hE_finrank] at hrn
  omega

private lemma flanders_normal_form {p q : ℕ}
    (S' : Submodule ℂ (Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ))
    (hM₀ : Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 0 ∈ S')
    (hrank : ∀ M ∈ S', M.rank ≤ p) :
    Module.finrank ℂ S' ≤ (p + q) * p ∧ (Module.finrank ℂ S' = (p + q) * p →
      (∃ U' : Submodule ℂ (Fin p ⊕ Fin q → ℂ), Module.finrank ℂ U' = p ∧
        ∀ M ∈ S', LinearMap.range M.mulVecLin ≤ U') ∨
      (∃ W' : Submodule ℂ (Fin p ⊕ Fin q → ℂ), Module.finrank ℂ W' = q ∧
        ∀ M ∈ S', W' ≤ LinearMap.ker M.mulVecLin)) := by
  let π : S' →ₗ[ℂ] Matrix (Fin p) (Fin q) ℂ × Matrix (Fin q) (Fin p) ℂ :=
    { toFun := fun m => (m.1.toBlocks₁₂, m.1.toBlocks₂₁)
      map_add' := fun _ _ => rfl
      map_smul' := fun _ _ => rfl }
  let ψ : LinearMap.ker π →ₗ[ℂ] Matrix (Fin p) (Fin p) ℂ :=
    { toFun := fun m => m.1.1.toBlocks₁₁
      map_add' := fun _ _ => rfl
      map_smul' := fun _ _ => rfl }
  have hψ_inj : Function.Injective ψ := by
    intro m₁ m₂ hm
    have hsub : (m₁ - m₂).1.1.toBlocks₁₁ = 0 := by
      change m₁.1.1.toBlocks₁₁ - m₂.1.1.toBlocks₁₁ = 0
      exact sub_eq_zero.mpr hm
    have hm_ker : (m₁ - m₂).1 ∈ LinearMap.ker π := (m₁ - m₂).2
    rw [LinearMap.mem_ker] at hm_ker
    have hB0 : (m₁ - m₂).1.1.toBlocks₁₂ = 0 := congrArg Prod.fst hm_ker
    have hC0 : (m₁ - m₂).1.1.toBlocks₂₁ = 0 := congrArg Prod.snd hm_ker
    have hD0 : (m₁ - m₂).1.1.toBlocks₂₂ = 0 :=
      (block_identities_of_mem S' hM₀ hrank (m₁ - m₂).1.1 (m₁ - m₂).1.2).1
    have hM0 : (m₁ - m₂).1.1 = 0 := Matrix.ext_iff_blocks.mpr ⟨hsub, hB0, hC0, hD0⟩
    exact sub_eq_zero.mp (Subtype.ext (Subtype.ext hM0))
  have hmat_pp : Module.finrank ℂ (Matrix (Fin p) (Fin p) ℂ) = p * p := by
    rw [Module.finrank_matrix, Fintype.card_fin, CommSemiring.finrank_self, mul_one]
  have hker_le : Module.finrank ℂ (LinearMap.ker π) ≤ p * p := by
    rw [← LinearMap.finrank_range_of_inj hψ_inj, ← hmat_pp]
    exact Submodule.finrank_le _
  have hiso : ∀ x ∈ LinearMap.range π, ∀ y ∈ LinearMap.range π, x.2 * y.1 + y.2 * x.1 = 0 := by
    rintro _ ⟨m₁, rfl⟩ _ ⟨m₂, rfl⟩
    have h1 := (block_identities_of_mem S' hM₀ hrank m₁.1 m₁.2).2.1
    have h2 := (block_identities_of_mem S' hM₀ hrank m₂.1 m₂.2).2.1
    have h12 := (block_identities_of_mem S' hM₀ hrank (m₁.1 + m₂.1) (S'.add_mem m₁.2 m₂.2)).2.1
    have hexp : (m₁.1 + m₂.1).toBlocks₂₁ * (m₁.1 + m₂.1).toBlocks₁₂ =
        m₁.1.toBlocks₂₁ * m₁.1.toBlocks₁₂ +
        (m₁.1.toBlocks₂₁ * m₂.1.toBlocks₁₂ + m₂.1.toBlocks₂₁ * m₁.1.toBlocks₁₂) +
        m₂.1.toBlocks₂₁ * m₂.1.toBlocks₁₂ := by
      change (m₁.1.toBlocks₂₁ + m₂.1.toBlocks₂₁) * (m₁.1.toBlocks₁₂ + m₂.1.toBlocks₁₂) = _
      rw [Matrix.add_mul, Matrix.mul_add, Matrix.mul_add]
      abel
    rw [hexp, h1, h2, zero_add, add_zero] at h12
    exact h12
  have hW_le : Module.finrank ℂ (LinearMap.range π) ≤ p * q :=
    isotropic_finrank_le (LinearMap.range π) hiso
  have hrn := LinearMap.finrank_range_add_finrank_ker π
  have hS'_le : Module.finrank ℂ S' ≤ (p + q) * p := by
    have : p * q + p * p = (p + q) * p := by ring
    omega
  refine ⟨hS'_le, fun heq => ?_⟩
  have hker_eq : Module.finrank ℂ (LinearMap.ker π) = p * p := by
    have : p * q + p * p = (p + q) * p := by ring
    omega
  have hψ_surj : Function.Surjective ψ := by
    rw [← LinearMap.range_eq_top]
    apply Submodule.eq_top_of_finrank_eq
    rw [LinearMap.finrank_range_of_inj hψ_inj, hker_eq, hmat_pp]
  have hall_A : ∀ A : Matrix (Fin p) (Fin p) ℂ,
      Matrix.fromBlocks A (0 : Matrix (Fin p) (Fin q) ℂ)
        (0 : Matrix (Fin q) (Fin p) ℂ) (0 : Matrix (Fin q) (Fin q) ℂ) ∈ S' := by
    intro A
    obtain ⟨m, rfl⟩ := hψ_surj A
    have hm_ker : m.1 ∈ LinearMap.ker π := m.2
    rw [LinearMap.mem_ker] at hm_ker
    have hB0 : m.1.1.toBlocks₁₂ = 0 := congrArg Prod.fst hm_ker
    have hC0 : m.1.1.toBlocks₂₁ = 0 := congrArg Prod.snd hm_ker
    have hD0 : m.1.1.toBlocks₂₂ = 0 := (block_identities_of_mem S' hM₀ hrank m.1.1 m.1.2).1
    have heqM : Matrix.fromBlocks m.1.1.toBlocks₁₁ 0 0 0 = m.1.1 := by
      rw [← hB0, ← hC0, ← hD0, Matrix.fromBlocks_toBlocks]
    exact heqM ▸ m.1.2
  have hCAB_all : ∀ M ∈ S', ∀ A : Matrix (Fin p) (Fin p) ℂ,
      M.toBlocks₂₁ * A * M.toBlocks₁₂ = 0 := by
    intro M hM A
    have hD0 : M.toBlocks₂₂ = 0 := (block_identities_of_mem S' hM₀ hrank M hM).1
    let N := M - Matrix.fromBlocks M.toBlocks₁₁ 0 0 0 + Matrix.fromBlocks A 0 0 0
    have hN_mem : N ∈ S' :=
      S'.add_mem (S'.sub_mem hM (hall_A M.toBlocks₁₁)) (hall_A A)
    have hN_eq : N = Matrix.fromBlocks A M.toBlocks₁₂ M.toBlocks₂₁ 0 := by
      dsimp only [N]
      conv_lhs => rw [← Matrix.fromBlocks_toBlocks M, hD0]
      ext (i | i) (j | j) <;> simp
    have h3 := (block_identities_of_mem S' hM₀ hrank N hN_mem).2.2
    rwa [hN_eq, Matrix.toBlocks_fromBlocks₁₁, Matrix.toBlocks_fromBlocks₁₂,
      Matrix.toBlocks_fromBlocks₂₁] at h3
  have hor_each : ∀ M ∈ S', M.toBlocks₁₂ = 0 ∨ M.toBlocks₂₁ = 0 := by
    intro M hM
    by_contra! hboth
    rcases hboth with ⟨hB, hC⟩
    have hexB : ∃ j₁ : Fin p, ∃ j₂ : Fin q, M.toBlocks₁₂ j₁ j₂ ≠ 0 := by
      by_contra! hall
      exact hB (Matrix.ext hall)
    have hexC : ∃ i₁ : Fin q, ∃ i₂ : Fin p, M.toBlocks₂₁ i₁ i₂ ≠ 0 := by
      by_contra! hall
      exact hC (Matrix.ext hall)
    obtain ⟨j₁, j₂, hj⟩ := hexB
    obtain ⟨i₁, i₂, hi⟩ := hexC
    have hzero := congrFun (congrFun (hCAB_all M hM (Matrix.single i₂ j₁ (1 : ℂ))) i₁) j₂
    simp only [Matrix.zero_apply, Matrix.mul_apply] at hzero
    rw [Fintype.sum_eq_single j₁] at hzero
    · rw [Fintype.sum_eq_single i₂] at hzero
      · simp only [Matrix.single_apply_same, mul_one] at hzero
        exact mul_ne_zero hi hj hzero
      · intro v hv
        simp [hv.symm]
    · intro u hu
      have hinner : (∑ v : Fin p, M.toBlocks₂₁ i₁ v * Matrix.single i₂ j₁ (1 : ℂ) v u) = 0 := by
        refine Finset.sum_eq_zero fun v _ => ?_
        simp [hu.symm]
      rw [hinner, zero_mul]
  have hor_all : (∀ M ∈ S', M.toBlocks₂₁ = 0) ∨ (∀ M ∈ S', M.toBlocks₁₂ = 0) := by
    by_contra! hneither
    rcases hneither with ⟨⟨M₁, hM₁, hC₁⟩, ⟨M₂, hM₂, hB₂⟩⟩
    have hB₁ : M₁.toBlocks₁₂ = 0 := (hor_each M₁ hM₁).resolve_right hC₁
    have hC₂ : M₂.toBlocks₂₁ = 0 := (hor_each M₂ hM₂).resolve_left hB₂
    rcases hor_each (M₁ + M₂) (S'.add_mem hM₁ hM₂) with hB12 | hC12
    · have : M₁.toBlocks₁₂ + M₂.toBlocks₁₂ = 0 := hB12
      rw [hB₁, zero_add] at this
      exact hB₂ this
    · have : M₁.toBlocks₂₁ + M₂.toBlocks₂₁ = 0 := hC12
      rw [hC₂, add_zero] at this
      exact hC₁ this
  rcases hor_all with hallC | hallB
  · left
    let inlMap : (Fin p → ℂ) →ₗ[ℂ] (Fin p ⊕ Fin q → ℂ) :=
      { toFun := fun v => Sum.elim v 0
        map_add' := fun u v => by ext (i | i) <;> simp
        map_smul' := fun c v => by ext (i | i) <;> simp }
    have hinl_inj : Function.Injective inlMap := by
      intro u v huv
      ext i
      exact congrFun huv (Sum.inl i)
    refine ⟨LinearMap.range inlMap, ?_, ?_⟩
    · rw [LinearMap.finrank_range_of_inj hinl_inj, Module.finrank_pi, Fintype.card_fin]
    · intro M hM
      rintro _ ⟨x, rfl⟩
      have hD0 : M.toBlocks₂₂ = 0 := (block_identities_of_mem S' hM₀ hrank M hM).1
      have hC0 : M.toBlocks₂₁ = 0 := hallC M hM
      have hMeq : M = Matrix.fromBlocks M.toBlocks₁₁ M.toBlocks₁₂ 0 0 := by
        conv_lhs => rw [← Matrix.fromBlocks_toBlocks M, hC0, hD0]
      rw [LinearMap.mem_range]
      refine ⟨M.toBlocks₁₁ *ᵥ (x ∘ Sum.inl) + M.toBlocks₁₂ *ᵥ (x ∘ Sum.inr), ?_⟩
      change Sum.elim _ (0 : Fin q → ℂ) = M *ᵥ x
      conv_rhs => rw [hMeq, Matrix.fromBlocks_mulVec]
      simp
  · right
    let inrMap : (Fin q → ℂ) →ₗ[ℂ] (Fin p ⊕ Fin q → ℂ) :=
      { toFun := fun v => Sum.elim 0 v
        map_add' := fun u v => by ext (i | i) <;> simp
        map_smul' := fun c v => by ext (i | i) <;> simp }
    have hinr_inj : Function.Injective inrMap := by
      intro u v huv
      ext i
      exact congrFun huv (Sum.inr i)
    refine ⟨LinearMap.range inrMap, ?_, ?_⟩
    · rw [LinearMap.finrank_range_of_inj hinr_inj, Module.finrank_pi, Fintype.card_fin]
    · intro M hM
      rintro _ ⟨v, rfl⟩
      rw [LinearMap.mem_ker]
      have hD0 : M.toBlocks₂₂ = 0 := (block_identities_of_mem S' hM₀ hrank M hM).1
      have hB0 : M.toBlocks₁₂ = 0 := hallB M hM
      have hMeq : M = Matrix.fromBlocks M.toBlocks₁₁ 0 M.toBlocks₂₁ 0 := by
        conv_lhs => rw [← Matrix.fromBlocks_toBlocks M, hB0, hD0]
      change M *ᵥ Sum.elim 0 v = 0
      rw [hMeq, Matrix.fromBlocks_mulVec]
      ext (i | i) <;> simp

private lemma matrix_eq_zero_of_rank_eq_zero {n : ℕ} (A : Matrix (Fin n) (Fin n) ℂ)
    (h : A.rank = 0) : A = 0 := by
  have hbot : LinearMap.range A.mulVecLin = ⊥ :=
    Submodule.finrank_eq_zero.mp h
  ext i j
  have hmem : A.mulVecLin (Pi.single j 1) ∈ (⊥ : Submodule ℂ (Fin n → ℂ)) := by
    rw [← hbot]
    exact LinearMap.mem_range_self _ _
  rw [Submodule.mem_bot] at hmem
  have hi := congrFun hmem i
  simpa [Matrix.mulVec, dotProduct, Pi.single_apply] using hi

private lemma problem6_aux (n r : ℕ) (hr : r ≤ n)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (hS : ∀ A ∈ S, A.rank ≤ r) :
    Module.finrank ℂ S ≤ n * r ∧ (Module.finrank ℂ S = n * r →
      (∃ U : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ U = r ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ W = n - r ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  classical
  by_cases hr0 : r = 0
  · subst hr0
    have hS_bot : S = ⊥ := by
      rw [Submodule.eq_bot_iff]
      intro A hA
      exact matrix_eq_zero_of_rank_eq_zero A (Nat.le_zero.mp (hS A hA))
    rw [hS_bot, finrank_bot, mul_zero]
    refine ⟨le_rfl, fun _ => Or.inl ⟨⊥, finrank_bot ℂ _, fun A hA => ?_⟩⟩
    rw [Submodule.mem_bot] at hA
    simp [hA]
  · have hr_pos : 0 < r := Nat.pos_of_ne_zero hr0
    have hn_pos : 0 < n := lt_of_lt_of_le hr_pos hr
    let ranks : Finset ℕ := (Finset.range (r + 1)).filter (fun d => ∃ A ∈ S, A.rank = d)
    have h0_mem : 0 ∈ ranks := by
      rw [Finset.mem_filter]
      exact ⟨Finset.mem_range.mpr (by omega), 0, S.zero_mem, Matrix.rank_zero⟩
    let k := ranks.max' ⟨0, h0_mem⟩
    have hk_mem : k ∈ ranks := Finset.max'_mem ranks ⟨0, h0_mem⟩
    rcases (Finset.mem_filter.mp hk_mem).2 with ⟨A₀, hA₀_S, hk_eq⟩
    have hmax : ∀ A ∈ S, A.rank ≤ A₀.rank := by
      intro A hA
      rw [hk_eq]
      refine Finset.le_max' ranks A.rank ?_
      rw [Finset.mem_filter]
      exact ⟨Finset.mem_range.mpr (Nat.lt_succ_of_le (hS A hA)), A, hA, rfl⟩
    by_cases hA₀0 : A₀.rank = 0
    · have hS_bot : S = ⊥ := by
        rw [Submodule.eq_bot_iff]
        intro A hA
        exact matrix_eq_zero_of_rank_eq_zero A (Nat.le_zero.mp (hA₀0 ▸ hmax A hA))
      rw [hS_bot, finrank_bot]
      refine ⟨Nat.zero_le _, fun h_eq => ?_⟩
      have hnr_pos : 0 < n * r := Nat.mul_pos hn_pos hr_pos
      omega
    · have hp_pos : 0 < A₀.rank := Nat.pos_of_ne_zero hA₀0
      have hp_le_r : A₀.rank ≤ r := hS A₀ hA₀_S
      obtain ⟨V, U_mat, e, hV, hU, hnorm⟩ := Matrix.exists_rank_normal_form A₀
      obtain ⟨Vu, rfl⟩ := hV
      obtain ⟨Uu, rfl⟩ := hU
      let p := A₀.rank
      let q := Fintype.card (Fin n) - A₀.rank
      have hpq : p + q = n := by
        dsimp only [p, q]
        rw [Fintype.card_fin]
        omega
      let Φ : Matrix (Fin n) (Fin n) ℂ ≃ₗ[ℂ] Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ :=
        { toFun := fun A => ((Vu : Matrix _ _ ℂ) * A * (Uu : Matrix _ _ ℂ)).submatrix e.symm e.symm
          map_add' := fun A₁ A₂ => by simp [Matrix.mul_add, Matrix.add_mul, Matrix.submatrix_add]
          map_smul' := fun c A => by simp [Matrix.submatrix_smul]
          invFun := fun M => (↑Vu⁻¹ : Matrix _ _ ℂ) * M.submatrix e e * (↑Uu⁻¹ : Matrix _ _ ℂ)
          left_inv := fun A => by
            simp only [Matrix.submatrix_submatrix, Equiv.symm_comp_self, Matrix.submatrix_id_id]
            calc (↑Vu⁻¹ : Matrix _ _ ℂ) * ((Vu : Matrix _ _ ℂ) * A * (Uu : Matrix _ _ ℂ)) * ↑Uu⁻¹
                = ((↑Vu⁻¹ : Matrix _ _ ℂ) * ↑Vu) * A * ((Uu : Matrix _ _ ℂ) * ↑Uu⁻¹) := by
                  simp only [Matrix.mul_assoc]
              _ = A := by simp
          right_inv := fun M => by
            dsimp only
            have hmid : (Vu : Matrix _ _ ℂ) *
                ((↑Vu⁻¹ : Matrix _ _ ℂ) * M.submatrix e e * (↑Uu⁻¹ : Matrix _ _ ℂ)) *
                (Uu : Matrix _ _ ℂ) = M.submatrix e e := by
              calc (Vu : Matrix _ _ ℂ) *
                    ((↑Vu⁻¹ : Matrix _ _ ℂ) * M.submatrix e e * (↑Uu⁻¹ : Matrix _ _ ℂ)) *
                    (Uu : Matrix _ _ ℂ)
                  = ((Vu : Matrix _ _ ℂ) * ↑Vu⁻¹) * M.submatrix e e *
                      ((↑Uu⁻¹ : Matrix _ _ ℂ) * ↑Uu) := by
                    simp only [Matrix.mul_assoc]
                _ = M.submatrix e e := by simp
            rw [hmid, Matrix.submatrix_submatrix, Equiv.self_comp_symm, Matrix.submatrix_id_id] }
      let S' : Submodule ℂ (Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ) := S.map Φ.toLinearMap
      have hfinrank_eq : Module.finrank ℂ S' = Module.finrank ℂ S :=
        LinearEquiv.finrank_map_eq Φ S
      have hM₀_mem : Matrix.fromBlocks (1 : Matrix (Fin p) (Fin p) ℂ) 0 0 0 ∈ S' := by
        refine ⟨A₀, hA₀_S, ?_⟩
        change ((Vu : Matrix _ _ ℂ) * A₀ * (Uu : Matrix _ _ ℂ)).submatrix e.symm e.symm = _
        rw [hnorm, Matrix.submatrix_submatrix, Equiv.self_comp_symm, Matrix.submatrix_id_id]
      have hVdet : IsUnit (Vu : Matrix (Fin n) (Fin n) ℂ).det :=
        (Matrix.isUnit_iff_isUnit_det _).mp Vu.isUnit
      have hUdet : IsUnit (Uu : Matrix (Fin n) (Fin n) ℂ).det :=
        (Matrix.isUnit_iff_isUnit_det _).mp Uu.isUnit
      have hrank_S' : ∀ M ∈ S', M.rank ≤ p := by
        rintro _ ⟨A, hA, rfl⟩
        change (((Vu : Matrix _ _ ℂ) * A * (Uu : Matrix _ _ ℂ)).submatrix e.symm e.symm).rank ≤ p
        rw [Matrix.rank_submatrix, Matrix.rank_mul_eq_left_of_isUnit_det _ _ hUdet,
          Matrix.rank_mul_eq_right_of_isUnit_det _ _ hVdet]
        exact hmax A hA
      obtain ⟨hle', hrig'⟩ := flanders_normal_form S' hM₀_mem hrank_S'
      rw [hpq, hfinrank_eq] at hle'
      have hS_le_nr : Module.finrank ℂ S ≤ n * r :=
        hle'.trans (Nat.mul_le_mul_left n hp_le_r)
      refine ⟨hS_le_nr, fun hS_eq => ?_⟩
      have hp_eq_r : p = r := by
        have h1 : n * r ≤ n * p := hS_eq ▸ hle'
        have h2 : r ≤ p := Nat.le_of_mul_le_mul_left h1 hn_pos
        omega
      have hq_eq_nr : q = n - r := by omega
      have hS'_eq : Module.finrank ℂ S' = (p + q) * p := by
        rw [hfinrank_eq, hpq, hp_eq_r, hS_eq]
      let eL : (Fin p ⊕ Fin q → ℂ) ≃ₗ[ℂ] (Fin n → ℂ) :=
        { toFun := fun y => (↑Vu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (y ∘ e)
          map_add' := fun y₁ y₂ => by
            change (↑Vu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (y₁ ∘ e + y₂ ∘ e) = _
            rw [Matrix.mulVec_add]
          map_smul' := fun c y => by
            change (↑Vu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (c • (y ∘ e)) = _
            rw [Matrix.mulVec_smul]
            rfl
          invFun := fun z => ((Vu : Matrix _ _ ℂ) *ᵥ z) ∘ e.symm
          left_inv := fun y => by
            ext k
            simp only [Function.comp_apply, Matrix.mulVec_mulVec, Units.mul_inv,
              Matrix.one_mulVec, Equiv.apply_symm_apply]
          right_inv := fun z => by
            dsimp only
            have hcomp : (((Vu : Matrix _ _ ℂ) *ᵥ z) ∘ e.symm) ∘ e = (Vu : Matrix _ _ ℂ) *ᵥ z := by
              ext i
              simp
            rw [hcomp, Matrix.mulVec_mulVec, Units.inv_mul, Matrix.one_mulVec] }
      let eR : (Fin n → ℂ) ≃ₗ[ℂ] (Fin p ⊕ Fin q → ℂ) :=
        { toFun := fun x => ((↑Uu⁻¹ : Matrix _ _ ℂ) *ᵥ x) ∘ e.symm
          map_add' := fun x₁ x₂ => by
            ext k
            simp [Matrix.mulVec_add]
          map_smul' := fun c x => by
            ext k
            simp [Matrix.mulVec_smul]
          invFun := fun y => (Uu : Matrix _ _ ℂ) *ᵥ (y ∘ e)
          left_inv := fun x => by
            dsimp only
            have hcomp : (((↑Uu⁻¹ : Matrix _ _ ℂ) *ᵥ x) ∘ e.symm) ∘ e =
                (↑Uu⁻¹ : Matrix _ _ ℂ) *ᵥ x := by
              ext i
              simp
            rw [hcomp, Matrix.mulVec_mulVec, Units.mul_inv, Matrix.one_mulVec]
          right_inv := fun y => by
            ext k
            simp only [Function.comp_apply, Matrix.mulVec_mulVec, Units.inv_mul,
              Matrix.one_mulVec, Equiv.apply_symm_apply] }
      have hmulVec_rel : ∀ (A : Matrix (Fin n) (Fin n) ℂ) (x : Fin n → ℂ),
          A *ᵥ x = eL ((Φ A) *ᵥ (eR x)) := by
        intro A x
        have hsub : ∀ (M : Matrix (Fin p ⊕ Fin q) (Fin p ⊕ Fin q) ℂ) (u : Fin n → ℂ),
            (M *ᵥ (u ∘ e.symm)) ∘ e = M.submatrix e e *ᵥ u := by
          intro M u
          ext i
          simp only [Function.comp_apply, Matrix.mulVec, dotProduct, Matrix.submatrix_apply]
          rw [← Equiv.sum_comp e]
          simp
        change A *ᵥ x =
          (↑Vu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ
            (((Φ A) *ᵥ (((↑Uu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ x) ∘ e.symm)) ∘ e)
        rw [hsub (Φ A) ((↑Uu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ x),
          Matrix.mulVec_mulVec, Matrix.mulVec_mulVec]
        have hΦinv : (↑Vu⁻¹ : Matrix (Fin n) (Fin n) ℂ) *
            (Φ A).submatrix e e * (↑Uu⁻¹ : Matrix (Fin n) (Fin n) ℂ) = A :=
          Φ.left_inv A
        rw [hΦinv]
      rcases hrig' hS'_eq with ⟨U', hU'_dim, hU'_range⟩ | ⟨W', hW'_dim, hW'_ker⟩
      · left
        refine ⟨U'.map eL.toLinearMap, ?_, ?_⟩
        · rw [LinearEquiv.finrank_map_eq, hU'_dim, hp_eq_r]
        · intro A hA
          rintro _ ⟨x, rfl⟩
          rw [Matrix.mulVecLin_apply, hmulVec_rel A x]
          refine Submodule.mem_map_of_mem ?_
          exact hU'_range (Φ A) ⟨A, hA, rfl⟩ ⟨eR x, rfl⟩
      · right
        refine ⟨W'.map eR.symm.toLinearMap, ?_, ?_⟩
        · rw [LinearEquiv.finrank_map_eq, hW'_dim, hq_eq_nr]
        · intro A hA
          rintro _ ⟨y, hy, rfl⟩
          simp only [LinearEquiv.coe_toLinearMap, LinearMap.mem_ker, Matrix.mulVecLin_apply]
          rw [hmulVec_rel A (eR.symm y), eR.apply_symm_apply]
          have h0 : (Φ A) *ᵥ y = 0 := hW'_ker (Φ A) ⟨A, hA, rfl⟩ hy
          rw [h0, map_zero]

end Problem6Aux

theorem problem6 (n r : ℕ) (hr : r ≤ n)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (hS : ∀ A ∈ S, A.rank ≤ r) :
    Module.finrank ℂ S ≤ n * r ∧ (Module.finrank ℂ S = n * r →
      (∃ U : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ U = r ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ W = n - r ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  exact problem6_aux n r hr S hS

#print axioms problem6
