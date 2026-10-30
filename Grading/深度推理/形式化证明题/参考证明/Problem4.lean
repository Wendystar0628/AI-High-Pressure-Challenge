import Mathlib.LinearAlgebra.Matrix.Rank
import Mathlib.LinearAlgebra.Matrix.SchurComplement
import Mathlib.LinearAlgebra.Matrix.FiniteDimensional
import Mathlib.Analysis.Complex.Basic
import Mathlib.LinearAlgebra.Complex.FiniteDimensional
import Mathlib.Topology.Instances.Matrix
import Mathlib.Tactic.FunProp
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Ring
import Mathlib.Data.Matrix.Basis

open Matrix Module
open scoped ComplexOrder

namespace Flanders

def prodSubmoduleEquiv {K V V' : Type*} [Field K]
    [AddCommGroup V] [Module K V] [AddCommGroup V'] [Module K V']
    (P : Submodule K V) (Q : Submodule K V') : P.prod Q ≃ₗ[K] P × Q where
  toFun x := (⟨x.1.1, x.2.1⟩, ⟨x.1.2, x.2.2⟩)
  invFun x := ⟨(x.1.1, x.2.1), x.1.2, x.2.2⟩
  left_inv _ := rfl
  right_inv _ := rfl
  map_add' _ _ := rfl
  map_smul' _ _ := rfl

theorem rank_eq_zero_iff {m n : Type*} [Fintype m] [Fintype n]
    (A : Matrix m n ℂ) : A.rank = 0 ↔ A = 0 := by
  classical
  rw [Matrix.rank, Submodule.finrank_eq_zero, LinearMap.range_eq_bot]
  constructor
  · intro h
    apply Matrix.toLin'.injective
    change A.mulVecLin = (0 : Matrix m n ℂ).mulVecLin
    simpa only [Matrix.mulVecLin_zero] using h
  · intro h
    simp [h]

theorem rank_block_diagonal {m n : Type*} [Fintype m] [Fintype n]
    [DecidableEq m] [DecidableEq n] (A : Matrix m m ℂ) (D : Matrix n n ℂ) :
    (Matrix.fromBlocks A 0 0 D).rank = A.rank + D.rank := by
  let e := LinearEquiv.sumArrowLequivProdArrow m n ℂ ℂ
  have he : e.toLinearMap.comp (Matrix.fromBlocks A 0 0 D).mulVecLin =
      (A.mulVecLin.prodMap D.mulVecLin).comp e.toLinearMap := by
    apply LinearMap.ext
    intro x
    apply Prod.ext <;> ext i <;>
      simp [e, Matrix.fromBlocks_mulVec] <;> rfl
  have h := congrArg (fun f => finrank ℂ (LinearMap.range f)) he
  rw [LinearMap.range_comp, LinearEquiv.finrank_map_eq,
    LinearMap.range_comp_of_range_eq_top _ e.range,
    LinearMap.range_prodMap] at h
  exact h.trans (by
    simpa only [Module.finrank_prod, Matrix.rank] using
      (prodSubmoduleEquiv A.mulVecLin.range D.mulVecLin.range).finrank_eq)

theorem schur_eq_zero {m n : Type*} [Fintype m] [Fintype n]
    [DecidableEq m] [DecidableEq n]
    (A : Matrix m m ℂ) (B : Matrix m n ℂ) (C : Matrix n m ℂ)
    (D : Matrix n n ℂ) (hA : IsUnit A)
    (h : (Matrix.fromBlocks A B C D).rank ≤ Fintype.card m) :
    D = C * A⁻¹ * B := by
  letI := hA.nonempty_invertible.some
  have hL : IsUnit (Matrix.fromBlocks (1 : Matrix m m ℂ) 0 (C * ⅟A)
      (1 : Matrix n n ℂ)).det := by
    rw [← Matrix.isUnit_iff_isUnit_det, Matrix.isUnit_fromBlocks_zero₁₂]
    exact ⟨isUnit_one, isUnit_one⟩
  have hR : IsUnit (Matrix.fromBlocks (1 : Matrix m m ℂ) (⅟A * B) 0
      (1 : Matrix n n ℂ)).det := by
    rw [← Matrix.isUnit_iff_isUnit_det, Matrix.isUnit_fromBlocks_zero₂₁]
    exact ⟨isUnit_one, isUnit_one⟩
  rw [Matrix.fromBlocks_eq_of_invertible₁₁,
    Matrix.rank_mul_eq_left_of_isUnit_det _ _ hR,
    Matrix.rank_mul_eq_right_of_isUnit_det _ _ hL, rank_block_diagonal] at h
  have hAr : A.rank = Fintype.card m := by
    have hh := Matrix.rank_mul_eq_right_of_isUnit_det A (1 : Matrix m m ℂ)
      (Matrix.isUnit_det_of_invertible A)
    simpa using hh
  rw [hAr] at h
  have hz : (D - C * ⅟A * B).rank = 0 := by omega
  have hz' := (rank_eq_zero_iff _).mp hz
  rw [Matrix.invOf_eq_nonsing_inv] at hz'
  exact sub_eq_zero.mp hz'

open Filter Topology

theorem pencil_blocks {m n : Type*} [Fintype m] [Fintype n]
    [DecidableEq m] [DecidableEq n]
    (P : Matrix m m ℂ) (Q : Matrix m n ℂ) (R : Matrix n m ℂ)
    (D : Matrix n n ℂ)
    (h : ∀ t : ℂ, (Matrix.fromBlocks (1 + t • P) (t • Q) (t • R) (t • D)).rank ≤
      Fintype.card m) :
    D = 0 ∧ R * Q = 0 ∧ R * P * Q = 0 := by
  have hp : Continuous (fun t : ℂ => (1 : Matrix m m ℂ) + t • P) := by fun_prop
  have hi : ContinuousAt (fun t : ℂ => ((1 : Matrix m m ℂ) + t • P)⁻¹) 0 := by
    apply ContinuousAt.comp (g := Inv.inv) (by simpa using
      (continuousAt_matrix_inv (1 : Matrix m m ℂ) (by
        simpa only [Matrix.det_one, Ring.inverse_eq_inv'] using
          (continuousAt_inv₀ (one_ne_zero : (1 : ℂ) ≠ 0)))))
    exact hp.continuousAt
  have hu : ∀ᶠ t : ℂ in 𝓝 0, IsUnit ((1 : Matrix m m ℂ) + t • P) := by
    have hc : ContinuousAt (fun t : ℂ => ((1 : Matrix m m ℂ) + t • P).det) 0 :=
      hp.matrix_det.continuousAt
    have hh : ∀ᶠ t : ℂ in 𝓝 0, ((1 : Matrix m m ℂ) + t • P).det ≠ 0 :=
      hc.eventually_ne (by simp)
    filter_upwards [hh] with t ht
    exact (Matrix.isUnit_iff_isUnit_det _).mpr (isUnit_iff_ne_zero.mpr ht)
  have he : ∀ᶠ t : ℂ in 𝓝[≠] 0,
      D = t • (R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q) := by
    filter_upwards [hu.filter_mono nhdsWithin_le_nhds, self_mem_nhdsWithin] with t ht ht0
    have hh := schur_eq_zero _ _ _ _ ht (h t)
    have ht' : t ≠ 0 := ht0
    simp only [Matrix.smul_mul, Matrix.mul_smul, smul_smul] at hh
    apply (smul_right_injective _ ht')
    simpa only [smul_smul] using hh
  have hlim : Tendsto (fun t : ℂ => t •
      (R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q)) (𝓝[≠] 0) (𝓝 0) := by
    have hc : ContinuousAt (fun t : ℂ => t •
      (R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q)) 0 := by
      fun_prop
    simpa using hc.tendsto.mono_left nhdsWithin_le_nhds
  have hD : D = 0 := tendsto_nhds_unique
    (tendsto_const_nhds.congr' he) hlim
  have he' : ∀ᶠ t : ℂ in 𝓝[≠] 0,
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q = 0 := by
    filter_upwards [he, self_mem_nhdsWithin] with t ht ht0
    rw [hD, eq_comm, smul_eq_zero] at ht
    exact ht.resolve_left ht0
  have hlim' : Tendsto (fun t : ℂ =>
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q) (𝓝[≠] 0) (𝓝 (R * Q)) := by
    have hc : ContinuousAt (fun t : ℂ =>
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * Q) 0 := by fun_prop
    simpa using hc.tendsto.mono_left nhdsWithin_le_nhds
  have hRQ : R * Q = 0 := tendsto_nhds_unique hlim'
    (tendsto_const_nhds.congr' (he'.mono fun _ ht => ht.symm))
  have he'' : ∀ᶠ t : ℂ in 𝓝[≠] 0,
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * P * Q = 0 := by
    filter_upwards [hu.filter_mono nhdsWithin_le_nhds, he', self_mem_nhdsWithin]
      with t ht ht' ht0
    have hinv := Matrix.nonsing_inv_mul ((1 : Matrix m m ℂ) + t • P)
      ((Matrix.isUnit_iff_isUnit_det _).mp ht)
    have hx := congrArg (fun M => R * M * Q) hinv
    simp only [Matrix.mul_add, Matrix.mul_one, Matrix.mul_smul, Matrix.mul_assoc,
      Matrix.add_mul, Matrix.smul_mul] at hx
    rw [← Matrix.mul_assoc R _ Q, ht', zero_add, hRQ] at hx
    have hz := (smul_eq_zero.mp hx).resolve_left ht0
    simpa only [Matrix.mul_assoc] using hz
  have hlim'' : Tendsto (fun t : ℂ =>
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * P * Q)
      (𝓝[≠] 0) (𝓝 (R * P * Q)) := by
    have hc : ContinuousAt (fun t : ℂ =>
      R * ((1 : Matrix m m ℂ) + t • P)⁻¹ * P * Q) 0 := by fun_prop
    simpa using hc.tendsto.mono_left nhdsWithin_le_nhds
  exact ⟨hD, hRQ, tendsto_nhds_unique hlim''
    (tendsto_const_nhds.congr' (he''.mono fun _ ht => ht.symm))⟩

def blend {m n : Type*} :
    Matrix (m ⊕ n) (m ⊕ n) ℂ →ₗ[ℝ] Matrix m m ℂ × Matrix m n ℂ where
  toFun A := (A.toBlocks₁₁, A.toBlocks₁₂ + A.toBlocks₂₁ᴴ)
  map_add' A B := by
    apply Prod.ext <;> ext i j <;> simp [Matrix.toBlocks₁₁, Matrix.toBlocks₁₂,
      Matrix.toBlocks₂₁, Matrix.conjTranspose, add_add_add_comm]
  map_smul' c A := by
    apply Prod.ext <;> ext i j <;> simp [Matrix.toBlocks₁₁, Matrix.toBlocks₁₂,
      Matrix.toBlocks₂₁, Matrix.conjTranspose, smul_add]

theorem blocks11_add {m n : Type*} (A B : Matrix (m ⊕ n) (m ⊕ n) ℂ) :
    (A + B).toBlocks₁₁ = A.toBlocks₁₁ + B.toBlocks₁₁ := rfl

theorem blocks12_add {m n : Type*} (A B : Matrix (m ⊕ n) (m ⊕ n) ℂ) :
    (A + B).toBlocks₁₂ = A.toBlocks₁₂ + B.toBlocks₁₂ := rfl

theorem blocks21_add {m n : Type*} (A B : Matrix (m ⊕ n) (m ⊕ n) ℂ) :
    (A + B).toBlocks₂₁ = A.toBlocks₂₁ + B.toBlocks₂₁ := rfl

theorem normalized {m n : Type*} [Fintype m] [Fintype n]
    [DecidableEq m] [DecidableEq n]
    (S : Submodule ℂ (Matrix (m ⊕ n) (m ⊕ n) ℂ))
    (hA : Matrix.fromBlocks (1 : Matrix m m ℂ) 0 0 (0 : Matrix n n ℂ) ∈ S)
    (hS : ∀ A ∈ S, A.rank ≤ Fintype.card m) :
    finrank ℂ S ≤ (Fintype.card m + Fintype.card n) * Fintype.card m ∧
    (finrank ℂ S = (Fintype.card m + Fintype.card n) * Fintype.card m →
      (∀ A ∈ S, A.toBlocks₁₂ = 0) ∨ (∀ A ∈ S, A.toBlocks₂₁ = 0)) := by
  have hb (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) (hAS : A ∈ S) :
      A.toBlocks₂₂ = 0 ∧ A.toBlocks₂₁ * A.toBlocks₁₂ = 0 ∧
        A.toBlocks₂₁ * A.toBlocks₁₁ * A.toBlocks₁₂ = 0 := by
    apply pencil_blocks
    intro t
    have hm := hS _ (S.add_mem hA (S.smul_mem t hAS))
    convert hm using 1
    congr 1
    ext (i | i) (j | j) <;> simp [Matrix.toBlocks₁₁, Matrix.toBlocks₁₂,
      Matrix.toBlocks₂₁, Matrix.toBlocks₂₂]
  let f : S →ₗ[ℝ] Matrix m m ℂ × Matrix m n ℂ :=
    blend.comp (S.subtype.restrictScalars ℝ)
  have hf0 (A : S) (h : f A = 0) : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) = 0 := by
    have hp : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₁ = 0 := congrArg Prod.fst h
    have hq : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₂ =
        -(A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₂₁ᴴ :=
      eq_neg_of_add_eq_zero_left (congrArg Prod.snd h)
    obtain ⟨hd, hrq, _⟩ := hb A A.2
    rw [hq, Matrix.mul_neg, neg_eq_zero] at hrq
    have hr := Matrix.self_mul_conjTranspose_eq_zero.mp hrq
    have hq' : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₂ = 0 := by simp [hq, hr]
    rw [← Matrix.fromBlocks_toBlocks (A : Matrix (m ⊕ n) (m ⊕ n) ℂ), hp, hq', hr, hd]
    simp
  have hf : Function.Injective f := by
    rw [← LinearMap.ker_eq_bot, LinearMap.ker_eq_bot']
    intro A h
    apply Subtype.ext
    exact hf0 A h
  have hdimS : finrank ℝ S = 2 * finrank ℂ S := by
    rw [← Module.finrank_mul_finrank ℝ ℂ S, Complex.finrank_real_complex]
  have hdimT : finrank ℝ (Matrix m m ℂ × Matrix m n ℂ) =
      2 * ((Fintype.card m + Fintype.card n) * Fintype.card m) := by
    simp only [Module.finrank_prod, Module.finrank_matrix, Complex.finrank_real_complex]
    ring
  have hdim := LinearMap.finrank_le_finrank_of_injective hf
  rw [hdimS, hdimT] at hdim
  refine ⟨by omega, ?_⟩
  intro heq
  have hsurj : Function.Surjective f :=
    (LinearMap.injective_iff_surjective_of_finrank_eq_finrank (by
      rw [hdimS, hdimT, heq])).mp hf
  have hfull (P : Matrix m m ℂ) :
      Matrix.fromBlocks P 0 0 (0 : Matrix n n ℂ) ∈ S := by
    obtain ⟨A, ha⟩ := hsurj (P, 0)
    have hp : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₁ = P := congrArg Prod.fst ha
    have hq : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₂ =
        -(A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₂₁ᴴ :=
      eq_neg_of_add_eq_zero_left (congrArg Prod.snd ha)
    obtain ⟨hd, hrq, _⟩ := hb A A.2
    rw [hq, Matrix.mul_neg, neg_eq_zero] at hrq
    have hr := Matrix.self_mul_conjTranspose_eq_zero.mp hrq
    have hq' : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ).toBlocks₁₂ = 0 := by simp [hq, hr]
    have hh : (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) = Matrix.fromBlocks P 0 0 0 := by
      rw [← Matrix.fromBlocks_toBlocks (A : Matrix (m ⊕ n) (m ⊕ n) ℂ), hp, hq', hr, hd]
    exact hh ▸ A.2
  have hRPQ (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) (ha : A ∈ S) (P : Matrix m m ℂ) :
      A.toBlocks₂₁ * P * A.toBlocks₁₂ = 0 := by
    have h := (hb (A + Matrix.fromBlocks P 0 0 0) (S.add_mem ha (hfull P))).2.2
    have h' := (hb A ha).2.2
    simp only [blocks11_add, blocks12_add, blocks21_add, Matrix.toBlocks_fromBlocks₁₁,
      Matrix.toBlocks_fromBlocks₁₂, Matrix.toBlocks_fromBlocks₂₁, add_zero,
      Matrix.mul_add, Matrix.add_mul, h', zero_add] at h
    exact h
  have hor (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) (ha : A ∈ S) :
      A.toBlocks₁₂ = 0 ∨ A.toBlocks₂₁ = 0 := by
    by_cases hq : A.toBlocks₁₂ = 0
    · exact Or.inl hq
    right
    obtain ⟨i, j, hij⟩ : ∃ i j, A.toBlocks₁₂ i j ≠ 0 := by
      by_contra h
      apply hq
      ext i j
      by_contra hij
      exact h ⟨i, j, hij⟩
    ext a b
    have hh := congrArg (fun M => M a j) (hRPQ A ha (Matrix.single b i 1))
    have hh' : A.toBlocks₂₁ a b * A.toBlocks₁₂ i j = 0 := by
      simpa [Matrix.mul_apply, Matrix.single, ite_and] using hh
    exact (mul_eq_zero.mp hh').resolve_right hij
  by_cases hq : ∀ A ∈ S, A.toBlocks₁₂ = 0
  · exact Or.inl hq
  right
  push Not at hq
  obtain ⟨A, ha, hq⟩ := hq
  have hr := (hor A ha).resolve_left hq
  intro B hbS
  rcases hor B hbS with hB | hB
  · have hAB := hor (A + B) (S.add_mem ha hbS)
    simp only [blocks12_add, blocks21_add, hB, hr, add_zero, zero_add] at hAB
    exact hAB.resolve_left hq
  · exact hB

def leftEmbedding (m n : Type*) : (m → ℂ) →ₗ[ℂ] (m ⊕ n → ℂ) where
  toFun x := Sum.elim x 0
  map_add' _ _ := by ext (i | i) <;> simp
  map_smul' _ _ := by ext (i | i) <;> simp

def rightEmbedding (m n : Type*) : (n → ℂ) →ₗ[ℂ] (m ⊕ n → ℂ) where
  toFun x := Sum.elim 0 x
  map_add' _ _ := by ext (i | i) <;> simp
  map_smul' _ _ := by ext (i | i) <;> simp

theorem leftEmbedding_injective (m n : Type*) : Function.Injective (leftEmbedding m n) := by
  intro x y h
  exact funext fun i => congrFun h (Sum.inl i)

theorem rightEmbedding_injective (m n : Type*) : Function.Injective (rightEmbedding m n) := by
  intro x y h
  exact funext fun i => congrFun h (Sum.inr i)

theorem normalized_result {m n : Type*} [Fintype m] [Fintype n]
    [DecidableEq m] [DecidableEq n]
    (S : Submodule ℂ (Matrix (m ⊕ n) (m ⊕ n) ℂ))
    (hA : Matrix.fromBlocks (1 : Matrix m m ℂ) 0 0 (0 : Matrix n n ℂ) ∈ S)
    (hS : ∀ A ∈ S, A.rank ≤ Fintype.card m) :
    finrank ℂ S ≤ (Fintype.card m + Fintype.card n) * Fintype.card m ∧
    (finrank ℂ S = (Fintype.card m + Fintype.card n) * Fintype.card m →
      (∃ U : Submodule ℂ (m ⊕ n → ℂ), finrank ℂ U = Fintype.card m ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (m ⊕ n → ℂ), finrank ℂ W = Fintype.card n ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  obtain ⟨hdim, heq⟩ := normalized S hA hS
  refine ⟨hdim, fun hh => ?_⟩
  have hD (A : Matrix (m ⊕ n) (m ⊕ n) ℂ) (ha : A ∈ S) : A.toBlocks₂₂ = 0 := by
    apply (pencil_blocks A.toBlocks₁₁ A.toBlocks₁₂ A.toBlocks₂₁ A.toBlocks₂₂ _).1
    intro t
    have hm := hS _ (S.add_mem hA (S.smul_mem t ha))
    convert hm using 1
    congr 1
    ext (i | i) (j | j) <;> simp [Matrix.toBlocks₁₁, Matrix.toBlocks₁₂,
      Matrix.toBlocks₂₁, Matrix.toBlocks₂₂]
  rcases heq hh with hQ | hR
  · right
    refine ⟨(rightEmbedding m n).range, ?_, ?_⟩
    · rw [LinearMap.finrank_range_of_inj (rightEmbedding_injective m n)]
      simp
    · intro A ha x hx
      obtain ⟨v, rfl⟩ := hx
      rw [LinearMap.mem_ker, ← Matrix.fromBlocks_toBlocks A, hQ A ha, hD A ha]
      ext (i | i) <;> simp [Matrix.fromBlocks_mulVec, rightEmbedding,
        Function.comp_def, Matrix.mulVec, dotProduct]
  · left
    refine ⟨(leftEmbedding m n).range, ?_, ?_⟩
    · rw [LinearMap.finrank_range_of_inj (leftEmbedding_injective m n)]
      simp
    · intro A ha x hx
      obtain ⟨v, rfl⟩ := hx
      refine ⟨(A.mulVecLin v) ∘ Sum.inl, ?_⟩
      rw [← Matrix.fromBlocks_toBlocks A, hR A ha, hD A ha]
      ext (i | i) <;> simp [Matrix.fromBlocks_mulVec, leftEmbedding,
        Function.comp_def]

theorem transport_result {a b : Type*} [Fintype a] [Fintype b]
    (S : Submodule ℂ (Matrix a a ℂ))
    (E : Matrix a a ℂ ≃ₗ[ℂ] Matrix b b ℂ)
    (L : (a → ℂ) ≃ₗ[ℂ] (b → ℂ))
    (R : (b → ℂ) ≃ₗ[ℂ] (a → ℂ))
    (hE : ∀ A, (E A).mulVecLin = L.toLinearMap.comp (A.mulVecLin.comp R.toLinearMap))
    (u w : ℕ)
    (h : (∃ U : Submodule ℂ (b → ℂ), finrank ℂ U = u ∧
          ∀ A ∈ S.map E.toLinearMap, LinearMap.range A.mulVecLin ≤ U) ∨
        (∃ W : Submodule ℂ (b → ℂ), finrank ℂ W = w ∧
          ∀ A ∈ S.map E.toLinearMap, W ≤ LinearMap.ker A.mulVecLin)) :
    (∃ U : Submodule ℂ (a → ℂ), finrank ℂ U = u ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
    (∃ W : Submodule ℂ (a → ℂ), finrank ℂ W = w ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin) := by
  have hmem (A : Matrix a a ℂ) (ha : A ∈ S) : E A ∈ S.map E.toLinearMap :=
    Submodule.mem_map.mpr ⟨A, ha, rfl⟩
  rcases h with ⟨U, hu, hU⟩ | ⟨W, hw, hW⟩
  · left
    refine ⟨U.map L.symm.toLinearMap, ?_, ?_⟩
    · rw [LinearEquiv.finrank_map_eq, hu]
    · intro A ha y hy
      obtain ⟨x, rfl⟩ := hy
      have hx : L (A.mulVecLin x) ∈ U := by
        apply hU _ (hmem A ha)
        refine ⟨R.symm x, ?_⟩
        simp [hE]
      exact Submodule.mem_map.mpr ⟨L (A.mulVecLin x), hx, by simp⟩
  · right
    refine ⟨W.map R.toLinearMap, ?_, ?_⟩
    · rw [LinearEquiv.finrank_map_eq, hw]
    · intro A ha y hy
      obtain ⟨x, hx, rfl⟩ := Submodule.mem_map.mp hy
      have hz := hW _ (hmem A ha) hx
      rw [LinearMap.mem_ker, hE] at hz
      rw [LinearMap.mem_ker]
      apply L.injective
      simpa using hz

theorem max_rank_result (n : ℕ)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (M : Matrix (Fin n) (Fin n) ℂ) (hM : M ∈ S)
    (hS : ∀ A ∈ S, A.rank ≤ M.rank) :
    finrank ℂ S ≤ n * M.rank ∧ (finrank ℂ S = n * M.rank →
      (∃ U : Submodule ℂ (Fin n → ℂ), finrank ℂ U = M.rank ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), finrank ℂ W = n - M.rank ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  classical
  obtain ⟨V, U, e, hV, hU, hform⟩ := Matrix.exists_rank_normal_form M
  let E : Matrix (Fin n) (Fin n) ℂ ≃ₗ[ℂ]
      Matrix (Fin M.rank ⊕ Fin (Fintype.card (Fin n) - M.rank))
        (Fin M.rank ⊕ Fin (Fintype.card (Fin n) - M.rank)) ℂ :=
    ((hV.unit.mulLeftLinearEquiv ℂ _).trans (hU.unit.mulRightLinearEquiv ℂ)).trans
      (Matrix.reindexLinearEquiv ℂ ℂ e e)
  have hEa (A : Matrix (Fin n) (Fin n) ℂ) :
      E A = (V * A * U).reindex e e := by simp [E]
  have hEr (A : Matrix (Fin n) (Fin n) ℂ) : (E A).rank = A.rank := by
    rw [hEa, Matrix.rank_reindex,
      Matrix.rank_mul_eq_left_of_isUnit_det _ _ ((Matrix.isUnit_iff_isUnit_det _).mp hU),
      Matrix.rank_mul_eq_right_of_isUnit_det _ _ ((Matrix.isUnit_iff_isUnit_det _).mp hV)]
  let T := S.map E.toLinearMap
  have hT : ∀ A ∈ T, A.rank ≤ Fintype.card (Fin M.rank) := by
    intro A ha
    obtain ⟨B, hb, rfl⟩ := Submodule.mem_map.mp ha
    simpa only [LinearEquiv.coe_coe, hEr, Fintype.card_fin] using hS B hb
  have hN : Matrix.fromBlocks (1 : Matrix (Fin M.rank) (Fin M.rank) ℂ) 0 0
      (0 : Matrix (Fin (Fintype.card (Fin n) - M.rank))
        (Fin (Fintype.card (Fin n) - M.rank)) ℂ) ∈ T := by
    refine Submodule.mem_map.mpr ⟨M, hM, ?_⟩
    rw [LinearEquiv.coe_coe, hEa, hform]
    ext i j
    simp [Matrix.reindex_apply]
  have hd : finrank ℂ T = finrank ℂ S := E.finrank_map_eq S
  have hn : M.rank + (n - M.rank) = n := Nat.add_sub_of_le M.rank_le_width
  obtain ⟨hbound, heq⟩ := normalized_result T hN hT
  simp only [Fintype.card_fin, hn, hd] at hbound heq
  refine ⟨hbound, fun hh => ?_⟩
  let L0 : (Fin n → ℂ) ≃ₗ[ℂ] (Fin n → ℂ) :=
    LinearEquiv.ofBijective V.mulVecLin
      ⟨Matrix.mulVec_injective_iff_isUnit.mpr hV, Matrix.mulVec_surjective_iff_isUnit.mpr hV⟩
  let R0 : (Fin n → ℂ) ≃ₗ[ℂ] (Fin n → ℂ) :=
    LinearEquiv.ofBijective U.mulVecLin
      ⟨Matrix.mulVec_injective_iff_isUnit.mpr hU, Matrix.mulVec_surjective_iff_isUnit.mpr hU⟩
  let L := L0.trans (LinearEquiv.funCongrLeft ℂ ℂ e.symm)
  let R := (LinearEquiv.funCongrLeft ℂ ℂ e).trans R0
  apply transport_result S E L R _ M.rank (n - M.rank) (heq hh)
  intro A
  rw [hEa, Matrix.mulVecLin_reindex, Matrix.mulVecLin_mul, Matrix.mulVecLin_mul]
  rfl

end Flanders

theorem problem4 (n r : ℕ) (hr : r ≤ n)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (hS : ∀ A ∈ S, A.rank ≤ r) :
    Module.finrank ℂ S ≤ n * r ∧ (Module.finrank ℂ S = n * r →
      (∃ U : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ U = r ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ W = n - r ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  classical
  let P : ℕ → Prop := fun k => ∃ A ∈ S, A.rank = k
  have h0 : P 0 := ⟨0, S.zero_mem, Matrix.rank_zero⟩
  let k := Nat.findGreatest P r
  have hkr : k ≤ r := Nat.findGreatest_le _
  obtain ⟨M, hM, hMk⟩ := Nat.findGreatest_spec (Nat.zero_le r) h0
  have hmax : ∀ A ∈ S, A.rank ≤ M.rank := by
    intro A ha
    rw [hMk]
    exact Nat.le_findGreatest (hS A ha) ⟨A, ha, rfl⟩
  obtain ⟨hbound, heq⟩ := Flanders.max_rank_result n S M hM hmax
  have hMr : M.rank ≤ r := hS M hM
  refine ⟨hbound.trans (Nat.mul_le_mul_left n hMr), fun hh => ?_⟩
  by_cases hn : n = 0
  · have hr0 : r = 0 := by omega
    left
    refine ⟨⊤, ?_, fun _ _ => le_top⟩
    simp [hn, hr0]
  have hrank : M.rank = r := by nlinarith
  rw [hrank] at heq
  exact heq hh
