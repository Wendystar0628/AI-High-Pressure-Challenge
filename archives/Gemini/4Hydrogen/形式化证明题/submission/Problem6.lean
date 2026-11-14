import Mathlib.Algebra.Polynomial.Roots
import Mathlib.Data.Complex.Basic
import Mathlib.Data.Matrix.Basis
import Mathlib.Data.Matrix.Block
import Mathlib.LinearAlgebra.Dual.Lemmas
import Mathlib.LinearAlgebra.FiniteDimensional.Lemmas
import Mathlib.LinearAlgebra.Matrix.Determinant.Basic
import Mathlib.LinearAlgebra.Matrix.Rank
import Mathlib.LinearAlgebra.Matrix.Trace

private lemma det_submatrix_eq_zero_of_rank_le {d m : ℕ}
    (M : Matrix (Fin d ⊕ Fin m) (Fin d ⊕ Fin m) ℂ) (hM : M.rank ≤ d)
    (r₀ c₀ : Fin d ⊕ Unit → Fin d ⊕ Fin m) :
    (M.submatrix r₀ c₀).det = 0 := by
  have hrk : (M.submatrix r₀ c₀).rank ≤ d := (Matrix.rank_submatrix_le M r₀ c₀).trans hM
  by_contra hdet
  have hfull := Matrix.rank_of_det_ne_zero hdet
  rw [Fintype.card_sum, Fintype.card_fin, Fintype.card_unit] at hfull
  omega

private lemma prod_X_add_C_coeff {d : ℕ} :
    ∀ f : Fin d → ℂ,
      (∏ a : Fin d, (Polynomial.X + Polynomial.C (f a))).coeff d = 1 := by
  induction d with
  | zero =>
    intro f
    simp
  | succ d ih =>
    intro f
    rw [Fin.prod_univ_succ]
    let q := ∏ a : Fin d, (Polynomial.X + Polynomial.C (f a.succ))
    have hdeg_q : q.natDegree ≤ d := by
      refine (Polynomial.natDegree_prod_le Finset.univ _).trans ?_
      have hterm : ∀ a ∈ (Finset.univ : Finset (Fin d)),
          (Polynomial.X + Polynomial.C (f a.succ)).natDegree ≤ 1 := by
        intro a _
        exact (Polynomial.natDegree_add_le _ _).trans
          (max_le (by simp) (by simp))
      exact (Finset.sum_le_sum hterm).trans (by simp)
    have hq_succ : q.coeff (d + 1) = 0 := Polynomial.coeff_eq_zero_of_natDegree_lt (by omega)
    have hmul : ((Polynomial.X + Polynomial.C (f 0)) * q).coeff (d + 1) =
        q.coeff d + f 0 * q.coeff (d + 1) := by
      rw [add_mul, Polynomial.coeff_add, Polynomial.coeff_X_mul, Polynomial.coeff_C_mul]
    rw [hmul, hq_succ, mul_zero, add_zero]
    exact ih (fun a => f a.succ)

private lemma block₂₂_eq_zero {d m : ℕ}
    (A : Matrix (Fin d ⊕ Fin m) (Fin d ⊕ Fin m) ℂ)
    (hA : ∀ t : ℂ, (A + t • Matrix.fromBlocks 1 0 0 0).rank ≤ d) :
    A.toBlocks₂₂ = 0 := by
  ext i j
  let r₀ : Fin d ⊕ Unit → Fin d ⊕ Fin m := Sum.elim Sum.inl (fun _ => Sum.inr i)
  let c₀ : Fin d ⊕ Unit → Fin d ⊕ Fin m := Sum.elim Sum.inl (fun _ => Sum.inr j)
  let P : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) :=
    Matrix.fromBlocks
      (A.toBlocks₁₁.map Polynomial.C + Polynomial.X • 1)
      ((A.toBlocks₁₂.submatrix id (fun _ => j)).map Polynomial.C)
      ((A.toBlocks₂₁.submatrix (fun _ => i) id).map Polynomial.C)
      (Matrix.of fun _ _ => Polynomial.C (A.toBlocks₂₂ i j))
  have hP_eval : ∀ t : ℂ, Polynomial.eval t P.det = 0 := by
    intro t
    have hmap : P.map (Polynomial.evalRingHom t) =
        (A + t • Matrix.fromBlocks 1 0 0 0).submatrix r₀ c₀ := by
      ext x y
      rcases x with a | ⟨⟩ <;> rcases y with b | ⟨⟩
      · by_cases hab : a = b <;>
          simp [P, r₀, c₀, hab, Matrix.toBlocks₁₁]
      · simp [P, r₀, c₀, Matrix.toBlocks₁₂]
      · simp [P, r₀, c₀, Matrix.toBlocks₂₁]
      · simp [P, r₀, c₀, Matrix.toBlocks₂₂]
    have hdet : Polynomial.eval t P.det = (P.map (Polynomial.evalRingHom t)).det := by
      change (Polynomial.evalRingHom t) P.det = _
      exact (Polynomial.evalRingHom t).map_det P
    rw [hdet, hmap]
    exact det_submatrix_eq_zero_of_rank_le _ (hA t) r₀ c₀
  have hP_zero : P.det = 0 := Polynomial.zero_of_eval_zero P.det hP_eval
  have hcoeff : P.det.coeff d = A.toBlocks₂₂ i j := by
    rw [Matrix.det_apply', Polynomial.finsetSum_coeff]
    have hsingle : ∀ σ ∈ (Finset.univ : Finset (Equiv.Perm (Fin d ⊕ Unit))),
        σ ≠ 1 → (↑(Equiv.Perm.sign σ) * ∏ u, P (σ u) u).coeff d = 0 := by
      intro σ _ hσ1
      have h_ex : ∃ a₀ : Fin d, σ (Sum.inl a₀) ≠ Sum.inl a₀ := by
        by_contra hall
        push Not at hall
        apply hσ1
        ext x
        rcases x with a | ⟨⟩
        · exact hall a
        · have hinr : σ (Sum.inr ()) = Sum.inr () := by
            rcases h : σ (Sum.inr ()) with b | ⟨⟩
            · have hinj : σ (Sum.inr ()) = σ (Sum.inl b) := by rw [h, hall b]
              exact absurd (σ.injective hinj) (by simp)
            · rfl
          exact hinr
      rcases h_ex with ⟨a₀, ha₀⟩
      have hdeg_entry : ∀ u : Fin d ⊕ Unit, (P (σ u) u).natDegree ≤ 1 := by
        intro u
        rcases u with a | ⟨⟩ <;> rcases hσu : σ _ with b | ⟨⟩
        · by_cases hba : b = a
          · subst hba
            have : P (Sum.inl b) (Sum.inl b) = Polynomial.C (A.toBlocks₁₁ b b) + Polynomial.X := by
              simp [P]
            rw [this]
            exact (Polynomial.natDegree_add_le _ _).trans (max_le (by simp) (by simp))
          · have : P (Sum.inl b) (Sum.inl a) = Polynomial.C (A.toBlocks₁₁ b a) := by
              simp [P, hba]
            rw [this]
            simp
        · simp [P]
        · simp [P]
        · simp [P]
      have hdeg_a₀ : (P (σ (Sum.inl a₀)) (Sum.inl a₀)).natDegree = 0 := by
        rcases hσa : σ (Sum.inl a₀) with b | ⟨⟩
        · have hba : b ≠ a₀ := fun h => ha₀ (by rw [hσa, h])
          have : P (Sum.inl b) (Sum.inl a₀) = Polynomial.C (A.toBlocks₁₁ b a₀) := by
            simp [P, hba]
          rw [this]
          simp
        · simp [P]
      have hdeg_inr : (P (σ (Sum.inr ())) (Sum.inr ())).natDegree = 0 := by
        rcases σ (Sum.inr ()) with b | ⟨⟩ <;> simp [P]
      have hdeg_prod : (∏ u : Fin d ⊕ Unit, P (σ u) u).natDegree < d := by
        refine (Polynomial.natDegree_prod_le Finset.univ _).trans_lt ?_
        let s : Finset (Fin d ⊕ Unit) := Finset.univ.erase (Sum.inl a₀) |>.erase (Sum.inr ())
        have hsum_eq : ∑ u : Fin d ⊕ Unit, (P (σ u) u).natDegree =
            ∑ u ∈ s, (P (σ u) u).natDegree := by
          have hmem_inr : Sum.inr () ∈ (Finset.univ : Finset (Fin d ⊕ Unit)) := Finset.mem_univ _
          have hmem_inl : Sum.inl a₀ ∈ (Finset.univ : Finset (Fin d ⊕ Unit)).erase (Sum.inr ()) :=
            Finset.mem_erase.mpr ⟨by simp, Finset.mem_univ _⟩
          have hs_eq : s = ((Finset.univ : Finset (Fin d ⊕ Unit)).erase (Sum.inr ())).erase (Sum.inl a₀) := by
            ext u
            simp [s, and_comm, and_left_comm]
          rw [hs_eq, ← Finset.add_sum_erase _ _ hmem_inl, hdeg_a₀, zero_add,
            ← Finset.add_sum_erase _ _ hmem_inr, hdeg_inr, zero_add]
        have hcard_s : s.card = d - 1 := by
          have h1 : ((Finset.univ : Finset (Fin d ⊕ Unit)).erase (Sum.inl a₀)).card = d := by
            rw [Finset.card_erase_of_mem (Finset.mem_univ _), Finset.card_univ, Fintype.card_sum,
              Fintype.card_fin, Fintype.card_unit]
            omega
          have hinr : Sum.inr () ∈ (Finset.univ : Finset (Fin d ⊕ Unit)).erase (Sum.inl a₀) :=
            Finset.mem_erase.mpr ⟨by simp, Finset.mem_univ _⟩
          dsimp only [s]
          rw [Finset.card_erase_of_mem hinr, h1]
        have hd_pos : 0 < d := Fin.pos a₀
        calc
          ∑ u : Fin d ⊕ Unit, (P (σ u) u).natDegree
              = ∑ u ∈ s, (P (σ u) u).natDegree := hsum_eq
          _ ≤ ∑ _u ∈ s, 1 := Finset.sum_le_sum fun u _ => hdeg_entry u
          _ = s.card := by simp
          _ = d - 1 := hcard_s
          _ < d := Nat.sub_lt hd_pos zero_lt_one
      have hdeg_total : (↑(Equiv.Perm.sign σ) * ∏ u, P (σ u) u).natDegree < d := by
        rcases Int.units_eq_one_or (Equiv.Perm.sign σ) with h | h
        · simpa [h] using hdeg_prod
        · simpa [h] using hdeg_prod
      exact Polynomial.coeff_eq_zero_of_natDegree_lt hdeg_total
    rw [Finset.sum_eq_single 1 hsingle (by simp)]
    simp only [map_one, Units.val_one, Int.cast_one, one_mul]
    rw [Fintype.prod_sum_type, Finset.univ_unique]
    simp only [Equiv.Perm.coe_one, id_eq, Finset.prod_singleton]
    have hdiag : ∀ a : Fin d, P (Sum.inl a) (Sum.inl a) = Polynomial.X + Polynomial.C (A.toBlocks₁₁ a a) := by
      intro a
      simp [P, add_comm]
    have hinr : P (Sum.inr ()) (Sum.inr ()) = Polynomial.C (A.toBlocks₂₂ i j) := by simp [P]
    rw [hinr, mul_comm, Finset.prod_congr rfl fun a _ => hdiag a, Polynomial.coeff_C_mul,
      prod_X_add_C_coeff, mul_one]
  rw [hP_zero, Polynomial.coeff_zero] at hcoeff
  exact hcoeff.symm

private lemma smul_matrix_pow {R : Type*} {n : ℕ} [CommSemiring R]
    (a : R) (M : Matrix (Fin n) (Fin n) R) :
    ∀ k : ℕ, (a • M) ^ k = a ^ k • M ^ k := by
  intro k
  induction k with
  | zero => simp
  | succ k ih =>
    rw [pow_succ, pow_succ, pow_succ, ih, Matrix.smul_mul, Matrix.mul_smul, smul_smul, mul_comm]

private lemma sum_pow_mul_one_sub {R : Type*} {n : ℕ} [Ring R]
    (Y : Matrix (Fin n) (Fin n) R) :
    ∀ K : ℕ, (∑ m ∈ Finset.range K, Y ^ m) * (1 - Y) = 1 - Y ^ K := by
  intro K
  induction K with
  | zero => simp
  | succ K ih =>
    rw [Finset.sum_range_succ, add_mul, ih, pow_succ, mul_sub, mul_one]
    abel

private lemma dvd_of_X_pow_dvd_mul_of_coeff_zero_eq_one
    (p q : Polynomial ℂ) (hp0 : p.coeff 0 = 1) :
    ∀ K : ℕ, Polynomial.X ^ K ∣ p * q → Polynomial.X ^ K ∣ q := by
  intro K h
  induction K generalizing q with
  | zero => simp
  | succ K ih =>
    have hX_dvd_pq : Polynomial.X ∣ p * q :=
      dvd_trans (by rw [pow_succ']; exact dvd_mul_right _ _) h
    have hX_dvd_q : Polynomial.X ∣ q := by
      rcases Polynomial.prime_X.dvd_mul.mp hX_dvd_pq with hXp | hXq
      · have := Polynomial.X_dvd_iff.mp hXp
        rw [hp0] at this
        exact absurd this one_ne_zero
      · exact hXq
    rcases hX_dvd_q with ⟨q', rfl⟩
    rw [pow_succ'] at h
    have hmul : Polynomial.X * Polynomial.X ^ K ∣ Polynomial.X * (p * q') := by
      have : p * (Polynomial.X * q') = Polynomial.X * (p * q') := by ring
      rwa [← this]
    have hK : Polynomial.X ^ K ∣ p * q' :=
      (mul_dvd_mul_iff_left Polynomial.X_ne_zero).mp hmul
    rw [pow_succ']
    exact mul_dvd_mul_left Polynomial.X (ih q' hK)

private lemma block₂₁_mul_pow_mul_block₁₂_eq_zero {d m : ℕ}
    (A : Matrix (Fin d ⊕ Fin m) (Fin d ⊕ Fin m) ℂ) (h22 : A.toBlocks₂₂ = 0)
    (hA : ∀ t : ℂ, (Matrix.fromBlocks 1 0 0 0 + t • A).rank ≤ d) :
    ∀ k : ℕ, A.toBlocks₂₁ * (A.toBlocks₁₁ ^ k) * A.toBlocks₁₂ = 0 := by
  intro k
  ext i j
  let r : Matrix Unit (Fin d) ℂ := A.toBlocks₂₁.submatrix (fun _ => i) id
  let c : Matrix (Fin d) Unit ℂ := A.toBlocks₁₂.submatrix id (fun _ => j)
  have hrc_eq : (A.toBlocks₂₁ * (A.toBlocks₁₁ ^ k) * A.toBlocks₁₂) i j =
      (r * (A.toBlocks₁₁ ^ k) * c) () () := by
    simp [r, c, Matrix.mul_apply]
  rw [hrc_eq]
  let B₁₁ : Matrix (Fin d) (Fin d) (Polynomial ℂ) := A.toBlocks₁₁.map Polynomial.C
  let rₚ : Matrix Unit (Fin d) (Polynomial ℂ) := r.map Polynomial.C
  let cₚ : Matrix (Fin d) Unit (Polynomial ℂ) := c.map Polynomial.C
  let r₀ : Fin d ⊕ Unit → Fin d ⊕ Fin m := Sum.elim Sum.inl (fun _ => Sum.inr i)
  let c₀ : Fin d ⊕ Unit → Fin d ⊕ Fin m := Sum.elim Sum.inl (fun _ => Sum.inr j)
  let M : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) :=
    Matrix.fromBlocks (1 + Polynomial.X • B₁₁) (Polynomial.X • cₚ) (Polynomial.X • rₚ) 0
  have hM_eval : ∀ t : ℂ, Polynomial.eval t M.det = 0 := by
    intro t
    have hmap : M.map (Polynomial.evalRingHom t) =
        (Matrix.fromBlocks 1 0 0 0 + t • A).submatrix r₀ c₀ := by
      ext x y
      rcases x with a | ⟨⟩ <;> rcases y with b | ⟨⟩
      · by_cases hab : a = b <;>
          simp [M, B₁₁, r₀, c₀, hab, Matrix.toBlocks₁₁]
      · simp [M, cₚ, c, r₀, c₀, Matrix.toBlocks₁₂]
      · simp [M, rₚ, r, r₀, c₀, Matrix.toBlocks₂₁]
      · have h22ij : A (Sum.inr i) (Sum.inr j) = 0 := by
          have := congr_fun (congr_fun h22 i) j
          simpa [Matrix.toBlocks₂₂] using this
        simp [M, r₀, c₀, h22ij]
    have hdet : Polynomial.eval t M.det = (M.map (Polynomial.evalRingHom t)).det := by
      change (Polynomial.evalRingHom t) M.det = _
      exact (Polynomial.evalRingHom t).map_det M
    rw [hdet, hmap]
    exact det_submatrix_eq_zero_of_rank_le _ (hA t) r₀ c₀
  have hM_zero : M.det = 0 := Polynomial.zero_of_eval_zero M.det hM_eval
  let M' : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) :=
    Matrix.fromBlocks (1 + Polynomial.X • B₁₁) (Polynomial.X • cₚ) rₚ 0
  have hM_fac : M = Matrix.fromBlocks 1 0 0 (Polynomial.X • (1 : Matrix Unit Unit (Polynomial ℂ))) * M' := by
    simp only [M, M', Matrix.fromBlocks_multiply, Matrix.one_mul, Matrix.mul_zero,
      Matrix.zero_mul, add_zero, zero_add, Matrix.smul_mul]
  have hM'_det : M'.det = 0 := by
    have hmul : M.det = Polynomial.X * M'.det := by
      rw [hM_fac, Matrix.det_mul, Matrix.det_fromBlocks_zero₂₁, Matrix.det_one, one_mul]
      have hdet1 : (Polynomial.X • (1 : Matrix Unit Unit (Polynomial ℂ))).det = Polynomial.X := by
        simp
      rw [hdet1]
    rw [hM_zero] at hmul
    exact (mul_eq_zero.mp hmul.symm).resolve_left Polynomial.X_ne_zero
  let K : ℕ := k + 2
  let Y : Matrix (Fin d) (Fin d) (Polynomial ℂ) := -(Polynomial.X • B₁₁)
  let S_K : Matrix (Fin d) (Fin d) (Polynomial ℂ) := ∑ m ∈ Finset.range K, Y ^ m
  have hS_mul : S_K * (1 + Polynomial.X • B₁₁) = 1 - Y ^ K := by
    have h1sub : (1 : Matrix (Fin d) (Fin d) (Polynomial ℂ)) - Y = 1 + Polynomial.X • B₁₁ := by
      dsimp only [Y]; abel
    rw [← h1sub]
    exact sum_pow_mul_one_sub Y K
  let L_K : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) :=
    Matrix.fromBlocks 1 0 (-rₚ * S_K) 1
  let N : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) := L_K * M'
  have hN_det : N.det = 0 := by
    dsimp only [N]
    rw [Matrix.det_mul, show L_K.det = 1 from by
      simp [L_K, Matrix.det_fromBlocks_zero₁₂], one_mul, hM'_det]
  have hN_21 : N.toBlocks₂₁ = rₚ * Y ^ K := by
    dsimp only [N, L_K, M']
    rw [Matrix.fromBlocks_multiply, Matrix.toBlocks_fromBlocks₂₁, Matrix.one_mul, Matrix.zero_mul,
      zero_add]
    calc
      -rₚ * S_K * (1 + Polynomial.X • B₁₁) + rₚ
          = rₚ * (1 - S_K * (1 + Polynomial.X • B₁₁)) := by noncomm_ring
      _ = rₚ * Y ^ K := by rw [hS_mul]; simp
  have hN_22 : N.toBlocks₂₂ = -rₚ * S_K * (Polynomial.X • cₚ) := by
    dsimp only [N, L_K, M']
    simp [Matrix.fromBlocks_multiply]
  have hYK_dvd : ∀ a b : Fin d, Polynomial.X ^ K ∣ (rₚ * Y ^ K) () b := by
    intro a b
    have hY : Y ^ K = (-Polynomial.X) ^ K • B₁₁ ^ K := by
      dsimp only [Y]
      rw [← neg_smul, smul_matrix_pow]
    rw [hY, Matrix.mul_smul, Matrix.smul_apply, smul_eq_mul]
    have hX : Polynomial.X ^ K ∣ (-Polynomial.X) ^ K := by
      rw [neg_eq_neg_one_mul, mul_pow]
      exact dvd_mul_left _ _
    exact dvd_mul_of_dvd_left hX _
  let N₀ : Matrix (Fin d ⊕ Unit) (Fin d ⊕ Unit) (Polynomial ℂ) :=
    Matrix.fromBlocks (1 + Polynomial.X • B₁₁) (Polynomial.X • cₚ) 0 N.toBlocks₂₂
  have hN_11 : N.toBlocks₁₁ = 1 + Polynomial.X • B₁₁ := by
    simp [N, L_K, M', Matrix.fromBlocks_multiply]
  have hN_12 : N.toBlocks₁₂ = Polynomial.X • cₚ := by
    simp [N, L_K, M', Matrix.fromBlocks_multiply]
  have hN_sub_N₀ : Polynomial.X ^ K ∣ (N.det - N₀.det) := by
    rw [Matrix.det_apply', Matrix.det_apply', ← Finset.sum_sub_distrib]
    refine Finset.dvd_sum fun σ _ => ?_
    rw [← mul_sub]
    refine dvd_mul_of_dvd_right ?_ _
    let u₀ := σ⁻¹ (Sum.inr ())
    have hσu₀ : σ u₀ = Sum.inr () := Equiv.apply_symm_apply σ (Sum.inr ())
    rcases hu₀ : u₀ with b | ⟨⟩
    · have h1 : Polynomial.X ^ K ∣ ∏ u, N (σ u) u := by
        refine dvd_trans ?_ (Finset.dvd_prod_of_mem _ (Finset.mem_univ u₀))
        have hNu₀ : N (σ u₀) u₀ = N.toBlocks₂₁ () b := by
          rw [hσu₀, hu₀]; rfl
        rw [hNu₀, hN_21]
        exact hYK_dvd () b
      have h2 : ∏ u, N₀ (σ u) u = 0 := by
        refine Finset.prod_eq_zero (Finset.mem_univ u₀) ?_
        have hN₀u₀ : N₀ (σ u₀) u₀ = 0 := by
          rw [hσu₀, hu₀]; simp [N₀]
        exact hN₀u₀
      rw [h2, sub_zero]
      exact h1
    · have hprod_eq : ∏ u, N (σ u) u = ∏ u, N₀ (σ u) u := by
        refine Finset.prod_congr rfl fun u _ => ?_
        rcases hσu : σ u with a | ⟨⟩
        · rcases u with c' | ⟨⟩
          · have : N (Sum.inl a) (Sum.inl c') = N.toBlocks₁₁ a c' := rfl
            rw [this, hN_11]; rfl
          · have : N (Sum.inl a) (Sum.inr ()) = N.toBlocks₁₂ a () := rfl
            rw [this, hN_12]; rfl
        · have hu_eq : u = Sum.inr () := by
            have := congrArg σ.symm hσu
            simpa [u₀, hu₀] using this.symm
          subst hu_eq
          rfl
      rw [hprod_eq, sub_self]
      exact dvd_zero _
  have hN₀_dvd : Polynomial.X ^ K ∣ (1 + Polynomial.X • B₁₁).det * N.toBlocks₂₂ () () := by
    have hN₀_det : N₀.det = (1 + Polynomial.X • B₁₁).det * N.toBlocks₂₂ () () := by
      dsimp only [N₀]
      rw [Matrix.det_fromBlocks_zero₂₁]
      simp
    rw [hN_det, zero_sub, dvd_neg] at hN_sub_N₀
    rwa [← hN₀_det]
  have hp0 : (1 + Polynomial.X • B₁₁).det.coeff 0 = 1 := by
    rw [Polynomial.coeff_zero_eq_eval_zero]
    change (Polynomial.evalRingHom 0) (1 + Polynomial.X • B₁₁).det = 1
    rw [RingHom.map_det]
    have hmap0 : (1 + Polynomial.X • B₁₁).map (Polynomial.evalRingHom 0) = 1 := by
      ext a b
      by_cases hab : a = b <;> simp [hab]
    rw [hmap0, Matrix.det_one]
  have hN₂₂_dvd : Polynomial.X ^ K ∣ N.toBlocks₂₂ () () :=
    dvd_of_X_pow_dvd_mul_of_coeff_zero_eq_one _ _ hp0 K hN₀_dvd
  have hcoeff_zero : (N.toBlocks₂₂ () ()).coeff (k + 1) = 0 :=
    (Polynomial.X_pow_dvd_iff.mp hN₂₂_dvd) (k + 1) (by omega)
  have hN₂₂_expand : N.toBlocks₂₂ () () =
      - ∑ m ∈ Finset.range K,
        Polynomial.C ((-1 : ℂ) ^ m * (r * A.toBlocks₁₁ ^ m * c) () ()) * Polynomial.X ^ (m + 1) := by
    rw [hN_22]
    dsimp only [S_K]
    rw [neg_mul, Matrix.sum_mul, Matrix.mul_sum, Matrix.neg_apply, Matrix.sum_apply]
    congr 1
    refine Finset.sum_congr rfl fun m _ => ?_
    have hYm : Y ^ m = (-Polynomial.X) ^ m • B₁₁ ^ m := by
      dsimp only [Y]
      rw [← neg_smul, smul_matrix_pow]
    rw [hYm, Matrix.mul_smul, Matrix.smul_mul, Matrix.mul_smul, Matrix.smul_mul,
      Matrix.smul_apply, Matrix.smul_apply, smul_eq_mul, smul_eq_mul]
    have hprod_map : (rₚ * B₁₁ ^ m * cₚ) () () = Polynomial.C ((r * A.toBlocks₁₁ ^ m * c) () ()) := by
      dsimp only [rₚ, B₁₁, cₚ]
      rw [← Matrix.map_pow, ← Matrix.map_mul, ← Matrix.map_mul]
      rfl
    rw [hprod_map]
    have hnegX : (-Polynomial.X : Polynomial ℂ) ^ m = Polynomial.C ((-1 : ℂ) ^ m) * Polynomial.X ^ m := by
      rw [neg_eq_neg_one_mul, mul_pow, show (-1 : Polynomial ℂ) ^ m = Polynomial.C ((-1 : ℂ) ^ m) by
        simp]
    rw [hnegX]
    ring
  rw [hN₂₂_expand, Polynomial.coeff_neg, Polynomial.finsetSum_coeff] at hcoeff_zero
  have hsum_coeff : (∑ m ∈ Finset.range K,
      (Polynomial.C ((-1 : ℂ) ^ m * (r * A.toBlocks₁₁ ^ m * c) () ()) *
        Polynomial.X ^ (m + 1)).coeff (k + 1)) =
      (-1 : ℂ) ^ k * (r * A.toBlocks₁₁ ^ k * c) () () := by
    have hkK : k ∈ Finset.range K := Finset.mem_range.mpr (by omega)
    rw [Finset.sum_eq_single k]
    · simp
    · intro m _ hmk
      rw [Polynomial.coeff_C_mul_X_pow]
      exact if_neg (by omega)
    · intro hk'
      exact absurd hkK hk'
  rw [hsum_coeff, neg_eq_zero, mul_eq_zero] at hcoeff_zero
  exact hcoeff_zero.resolve_left (pow_ne_zero k (by norm_num))

private lemma subspace_union_eq_top {K V : Type*} [Field K] [AddCommGroup V] [Module K V]
    (S₁ S₂ : Submodule K V) (h : ∀ v : V, v ∈ S₁ ∨ v ∈ S₂) :
    S₁ = ⊤ ∨ S₂ = ⊤ := by
  by_contra hnot
  push Not at hnot
  rcases hnot with ⟨h1, h2⟩
  have ⟨u, hu1⟩ : ∃ u, u ∉ S₁ := by
    by_contra hall
    push Not at hall
    exact h1 (Submodule.eq_top_iff'.mpr hall)
  have ⟨v, hv2⟩ : ∃ v, v ∉ S₂ := by
    by_contra hall
    push Not at hall
    exact h2 (Submodule.eq_top_iff'.mpr hall)
  have hu2 : u ∈ S₂ := (h u).resolve_left hu1
  have hv1 : v ∈ S₁ := (h v).resolve_right hv2
  rcases h (u + v) with huv1 | huv2
  · exact hu1 ((S₁.add_mem_iff_left hv1).mp huv1)
  · exact hv2 ((S₂.add_mem_iff_right hu2).mp huv2)

private lemma offdiag_analysis {d m : ℕ}
    (S' : Submodule ℂ (Matrix (Fin d ⊕ Fin m) (Fin d ⊕ Fin m) ℂ))
    (h22 : ∀ A ∈ S', A.toBlocks₂₂ = 0)
    (h0 : ∀ A ∈ S', A.toBlocks₂₁ * A.toBlocks₁₂ = 0)
    (h1 : ∀ A ∈ S', A.toBlocks₂₁ * A.toBlocks₁₁ * A.toBlocks₁₂ = 0) :
    Module.finrank ℂ S' ≤ d * (d + m) ∧
      (Module.finrank ℂ S' = d * (d + m) →
        (∀ A ∈ S', A.toBlocks₂₁ = 0) ∨ (∀ A ∈ S', A.toBlocks₁₂ = 0)) := by
  let W := Matrix (Fin d) (Fin m) ℂ × Matrix (Fin m) (Fin d) ℂ
  let φ : Matrix (Fin d ⊕ Fin m) (Fin d ⊕ Fin m) ℂ →ₗ[ℂ] W :=
    { toFun := fun A => (A.toBlocks₁₂, A.toBlocks₂₁)
      map_add' := fun A B => by
        ext <;> simp [Matrix.toBlocks₁₂, Matrix.toBlocks₂₁]
      map_smul' := fun c A => by
        ext <;> simp [Matrix.toBlocks₁₂, Matrix.toBlocks₂₁] }
  let φS : S' →ₗ[ℂ] W := φ.comp S'.subtype
  let κ : LinearMap.ker φS →ₗ[ℂ] Matrix (Fin d) (Fin d) ℂ :=
    { toFun := fun A => A.1.1.toBlocks₁₁
      map_add' := fun A B => by ext; simp [Matrix.toBlocks₁₁]
      map_smul' := fun c A => by ext; simp [Matrix.toBlocks₁₁] }
  have hκ_inj : Function.Injective κ := by
    intro A₁ A₂ heq
    ext x y
    rcases x with a | i <;> rcases y with b | j
    · exact congr_fun (congr_fun heq a) b
    · have hA₁ : φS A₁.1 = 0 := LinearMap.mem_ker.mp A₁.2
      have hA₂ : φS A₂.1 = 0 := LinearMap.mem_ker.mp A₂.2
      have h12₁ : A₁.1.1.toBlocks₁₂ = 0 := congrArg Prod.fst hA₁
      have h12₂ : A₂.1.1.toBlocks₁₂ = 0 := congrArg Prod.fst hA₂
      change A₁.1.1.toBlocks₁₂ a j = A₂.1.1.toBlocks₁₂ a j
      rw [h12₁, h12₂]
    · have hA₁ : φS A₁.1 = 0 := LinearMap.mem_ker.mp A₁.2
      have hA₂ : φS A₂.1 = 0 := LinearMap.mem_ker.mp A₂.2
      have h21₁ : A₁.1.1.toBlocks₂₁ = 0 := congrArg Prod.snd hA₁
      have h21₂ : A₂.1.1.toBlocks₂₁ = 0 := congrArg Prod.snd hA₂
      change A₁.1.1.toBlocks₂₁ i b = A₂.1.1.toBlocks₂₁ i b
      rw [h21₁, h21₂]
    · have h22₁ : A₁.1.1.toBlocks₂₂ = 0 := h22 A₁.1.1 A₁.1.2
      have h22₂ : A₂.1.1.toBlocks₂₂ = 0 := h22 A₂.1.1 A₂.1.2
      change A₁.1.1.toBlocks₂₂ i j = A₂.1.1.toBlocks₂₂ i j
      rw [h22₁, h22₂]
  have hker_le : Module.finrank ℂ (LinearMap.ker φS) ≤ d * d := by
    calc
      Module.finrank ℂ (LinearMap.ker φS) ≤ Module.finrank ℂ (Matrix (Fin d) (Fin d) ℂ) :=
        LinearMap.finrank_le_finrank_of_injective hκ_inj
      _ = d * d := by simp [Module.finrank_matrix]
  let B : W →ₗ[ℂ] Module.Dual ℂ W :=
    { toFun := fun w₁ =>
        { toFun := fun w₂ => Matrix.trace (w₁.2 * w₂.1 + w₂.2 * w₁.1)
          map_add' := fun w₂ w₃ => by
            simp [Matrix.mul_add, Matrix.add_mul, Matrix.trace_add]
            ring
          map_smul' := fun c w₂ => by
            simp [Matrix.mul_smul, Matrix.smul_mul, Matrix.trace_add, Matrix.trace_smul]
            ring }
      map_add' := fun w₁ w₃ => by
        ext w₂
        simp [Matrix.add_mul, Matrix.mul_add, Matrix.trace_add]
        ring
      map_smul' := fun c w₁ => by
        ext w₂
        simp [Matrix.smul_mul, Matrix.mul_smul, Matrix.trace_add, Matrix.trace_smul]
        ring }
  have hB_inj : Function.Injective B := by
    rw [injective_iff_map_eq_zero]
    intro w hw
    ext i j
    · have h1 := congrArg (fun f => f (0, Matrix.single j i 1)) hw
      simp only [B, LinearMap.coe_mk, AddHom.coe_mk, LinearMap.zero_apply,
        Matrix.mul_zero, zero_add, Matrix.trace_single_mul, smul_eq_mul, one_mul] at h1
      exact h1
    · have h2 := congrArg (fun f => f (Matrix.single j i 1, 0)) hw
      simp only [B, LinearMap.coe_mk, AddHom.coe_mk, LinearMap.zero_apply,
        Matrix.zero_mul, add_zero, Matrix.trace_mul_single, MulOpposite.smul_eq_mul_unop,
        MulOpposite.unop_one, one_mul] at h2
      exact h2
  let eB : W ≃ₗ[ℂ] Module.Dual ℂ W :=
    B.linearEquivOfInjective hB_inj Subspace.dual_finrank_eq.symm
  let L : Submodule ℂ W := LinearMap.range φS
  have hL_iso : Submodule.map eB.toLinearMap L ≤ L.dualAnnihilator := by
    rintro _ ⟨w₁, hw₁, rfl⟩
    intro w₂ hw₂
    rcases hw₁ with ⟨A₁, rfl⟩
    rcases hw₂ with ⟨A₂, rfl⟩
    have hsum : A₁.1 + A₂.1 ∈ S' := S'.add_mem A₁.2 A₂.2
    have hmul_sum := h0 (A₁.1 + A₂.1) hsum
    have hmul₁ := h0 A₁.1 A₁.2
    have hmul₂ := h0 A₂.1 A₂.2
    have hcross : A₁.1.toBlocks₂₁ * A₂.1.toBlocks₁₂ + A₂.1.toBlocks₂₁ * A₁.1.toBlocks₁₂ = 0 := by
      have hexp : (A₁.1 + A₂.1).toBlocks₂₁ * (A₁.1 + A₂.1).toBlocks₁₂ =
          A₁.1.toBlocks₂₁ * A₁.1.toBlocks₁₂ +
            (A₁.1.toBlocks₂₁ * A₂.1.toBlocks₁₂ + A₂.1.toBlocks₂₁ * A₁.1.toBlocks₁₂) +
            A₂.1.toBlocks₂₁ * A₂.1.toBlocks₁₂ := by
        have hb21 : (A₁.1 + A₂.1).toBlocks₂₁ = A₁.1.toBlocks₂₁ + A₂.1.toBlocks₂₁ := rfl
        have hb12 : (A₁.1 + A₂.1).toBlocks₁₂ = A₁.1.toBlocks₁₂ + A₂.1.toBlocks₁₂ := rfl
        rw [hb21, hb12, Matrix.add_mul, Matrix.mul_add, Matrix.mul_add]
        abel
      rw [hmul_sum, hmul₁, hmul₂, zero_add, add_zero] at hexp
      exact hexp.symm
    change Matrix.trace (A₁.1.toBlocks₂₁ * A₂.1.toBlocks₁₂ + A₂.1.toBlocks₂₁ * A₁.1.toBlocks₁₂) = 0
    rw [hcross, Matrix.trace_zero]
  have hL_le_ann : Module.finrank ℂ L ≤ Module.finrank ℂ L.dualAnnihilator := by
    calc
      Module.finrank ℂ L = Module.finrank ℂ (Submodule.map eB.toLinearMap L) :=
        (LinearEquiv.finrank_map_eq eB L).symm
      _ ≤ Module.finrank ℂ L.dualAnnihilator := Submodule.finrank_mono hL_iso
  have hW_dim : Module.finrank ℂ W = d * m + m * d := by
    rw [Module.finrank_prod, Module.finrank_matrix, Module.finrank_matrix]
    simp
  have hL_le : Module.finrank ℂ L ≤ d * m := by
    have hdual := Subspace.finrank_add_finrank_dualAnnihilator_eq L
    rw [hW_dim] at hdual
    have : d * m + m * d = 2 * (d * m) := by ring
    omega
  have hrk_null := LinearMap.finrank_range_add_finrank_ker φS
  have hS_le : Module.finrank ℂ S' ≤ d * (d + m) := by
    have : d * m + d * d = d * (d + m) := by ring
    omega
  refine ⟨hS_le, fun hS_eq => ?_⟩
  have hker_eq : Module.finrank ℂ (LinearMap.ker φS) = d * d := by
    have : d * m + d * d = d * (d + m) := by ring
    omega
  have hκ_surj : Function.Surjective κ :=
    (LinearMap.injective_iff_surjective_of_finrank_eq_finrank
      (by simpa [Module.finrank_matrix] using hker_eq)).mp hκ_inj
  have hC_mem : ∀ C : Matrix (Fin d) (Fin d) ℂ, Matrix.fromBlocks C 0 0 0 ∈ S' := by
    intro C
    obtain ⟨⟨A, hAker⟩, hAC⟩ := hκ_surj C
    have hA_ker : φS A = 0 := LinearMap.mem_ker.mp hAker
    have h12 : A.1.toBlocks₁₂ = 0 := congrArg Prod.fst hA_ker
    have h21 : A.1.toBlocks₂₁ = 0 := congrArg Prod.snd hA_ker
    have h22A : A.1.toBlocks₂₂ = 0 := h22 A.1 A.2
    have h11 : A.1.toBlocks₁₁ = C := hAC
    have hA_eq : A.1 = Matrix.fromBlocks C 0 0 0 := by
      rw [← Matrix.fromBlocks_toBlocks A.1, h11, h12, h21, h22A]
    rw [← hA_eq]
    exact A.2
  have h_ptwise : ∀ A ∈ S', A.toBlocks₂₁ = 0 ∨ A.toBlocks₁₂ = 0 := by
    intro A hA
    have h_mid : ∀ C : Matrix (Fin d) (Fin d) ℂ, A.toBlocks₂₁ * C * A.toBlocks₁₂ = 0 := by
      intro C
      have hAC : A + Matrix.fromBlocks C 0 0 0 ∈ S' := S'.add_mem hA (hC_mem C)
      have h1sum := h1 (A + Matrix.fromBlocks C 0 0 0) hAC
      have h1A := h1 A hA
      have hb21 : (A + Matrix.fromBlocks C 0 0 0).toBlocks₂₁ = A.toBlocks₂₁ := by
        ext i a; simp [Matrix.toBlocks₂₁]
      have hb12 : (A + Matrix.fromBlocks C 0 0 0).toBlocks₁₂ = A.toBlocks₁₂ := by
        ext a j; simp [Matrix.toBlocks₁₂]
      have hb11 : (A + Matrix.fromBlocks C 0 0 0).toBlocks₁₁ = A.toBlocks₁₁ + C := by
        ext a b; simp [Matrix.toBlocks₁₁]
      rw [hb21, hb12, hb11, Matrix.mul_add, Matrix.add_mul, h1A, zero_add] at h1sum
      exact h1sum
    by_cases h21 : A.toBlocks₂₁ = 0
    · exact Or.inl h21
    · right
      have hex : ∃ i a, A.toBlocks₂₁ i a ≠ 0 := by
        by_contra hall
        push Not at hall
        apply h21
        ext i a
        exact hall i a
      rcases hex with ⟨i, a, hia⟩
      ext b j
      have hentry := congr_fun (congr_fun (h_mid (Matrix.single a b 1)) i) j
      have hsingle : (A.toBlocks₂₁ * Matrix.single a b 1 * A.toBlocks₁₂) i j =
          A.toBlocks₂₁ i a * A.toBlocks₁₂ b j := by
        rw [Matrix.mul_apply, Finset.sum_eq_single b]
        · rw [Matrix.mul_single_apply_same, mul_one]
        · intro b' _ hb'b
          rw [Matrix.mul_single_apply_of_ne a b _ _ hb'b, zero_mul]
        · intro hb
          exact absurd (Finset.mem_univ b) hb
      rw [hsingle, Matrix.zero_apply, mul_eq_zero] at hentry
      exact hentry.resolve_left hia
  let S₁ : Submodule ℂ S' :=
    { carrier := {A | A.1.toBlocks₂₁ = 0}
      add_mem' := fun {A B} hA hB => by
        show (A.1 + B.1).toBlocks₂₁ = 0
        have : (A.1 + B.1).toBlocks₂₁ = A.1.toBlocks₂₁ + B.1.toBlocks₂₁ := rfl
        rw [this, hA, hB, add_zero]
      zero_mem' := rfl
      smul_mem' := fun c {A} hA => by
        show (c • A.1).toBlocks₂₁ = 0
        have : (c • A.1).toBlocks₂₁ = c • A.1.toBlocks₂₁ := rfl
        rw [this, hA, smul_zero] }
  let S₂ : Submodule ℂ S' :=
    { carrier := {A | A.1.toBlocks₁₂ = 0}
      add_mem' := fun {A B} hA hB => by
        show (A.1 + B.1).toBlocks₁₂ = 0
        have : (A.1 + B.1).toBlocks₁₂ = A.1.toBlocks₁₂ + B.1.toBlocks₁₂ := rfl
        rw [this, hA, hB, add_zero]
      zero_mem' := rfl
      smul_mem' := fun c {A} hA => by
        show (c • A.1).toBlocks₁₂ = 0
        have : (c • A.1).toBlocks₁₂ = c • A.1.toBlocks₁₂ := rfl
        rw [this, hA, smul_zero] }
  rcases subspace_union_eq_top S₁ S₂ (fun A => h_ptwise A.1 A.2) with htop1 | htop2
  · left
    intro A hA
    have : (⟨A, hA⟩ : S') ∈ S₁ := by rw [htop1]; trivial
    exact this
  · right
    intro A hA
    have : (⟨A, hA⟩ : S') ∈ S₂ := by rw [htop2]; trivial
    exact this

theorem problem6 (n r : ℕ) (hr : r ≤ n)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (hS : ∀ A ∈ S, A.rank ≤ r) :
    Module.finrank ℂ S ≤ n * r ∧ (Module.finrank ℂ S = n * r →
      (∃ U : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ U = r ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ W = n - r ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  classical
  let ranks : Finset ℕ := (Finset.range (r + 1)).filter (fun k => ∃ A ∈ S, A.rank = k)
  have h0_mem : 0 ∈ ranks := by
    refine Finset.mem_filter.mpr ⟨Finset.mem_range.mpr (Nat.zero_lt_succ r), 0, S.zero_mem, ?_⟩
    exact Matrix.rank_zero
  let d : ℕ := ranks.max' ⟨0, h0_mem⟩
  have hd_mem : d ∈ ranks := Finset.max'_mem ranks ⟨0, h0_mem⟩
  obtain ⟨hd_range, ⟨A₀, hA₀S, hA₀_rank⟩⟩ := Finset.mem_filter.mp hd_mem
  have hd_le_r : d ≤ r := Nat.lt_succ_iff.mp (Finset.mem_range.mp hd_range)
  have hS_le_d : ∀ A ∈ S, A.rank ≤ d := by
    intro A hA
    have hAr : A.rank ∈ ranks :=
      Finset.mem_filter.mpr ⟨Finset.mem_range.mpr (Nat.lt_succ_of_le (hS A hA)), A, hA, rfl⟩
    exact Finset.le_max' ranks A.rank hAr
  by_cases hd0 : d = 0
  · have hS_zero : ∀ A ∈ S, A = 0 := by
      intro A hA
      have hrk0 : A.rank = 0 := by
        have := hS_le_d A hA
        omega
      have hrange0 : LinearMap.range A.mulVecLin = ⊥ :=
        Submodule.finrank_eq_zero.mp hrk0
      ext i j
      have hv : A.mulVec (Pi.single j 1) = 0 := by
        have : A.mulVec (Pi.single j 1) ∈ LinearMap.range A.mulVecLin := ⟨Pi.single j 1, rfl⟩
        rw [hrange0, Submodule.mem_bot] at this
        exact this
      have := congrFun hv i
      simpa [Matrix.mulVec_single] using this
    have hS_bot : S = ⊥ := Submodule.eq_bot_iff.mpr hS_zero
    have hfin0 : Module.finrank ℂ S = 0 := by rw [hS_bot, finrank_bot]
    refine ⟨by omega, fun h_eq => ?_⟩
    rw [hfin0] at h_eq
    have hr0 : r = 0 := by
      rcases mul_eq_zero.mp h_eq.symm with hn0 | hr0
      · omega
      · exact hr0
    left
    refine ⟨⊥, by simp [hr0], fun A hA => ?_⟩
    rw [hS_zero A hA]
    simp
  have hd_pos : 0 < d := Nat.pos_of_ne_zero hd0
  obtain ⟨V, U, e_raw, hV_unit, hU_unit, hVU⟩ := Matrix.exists_rank_normal_form A₀
  let e₀ : Fin n ≃ Fin d ⊕ Fin (n - d) :=
    e_raw.trans (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank])))
  let V_u := hV_unit.unit
  let U_u := hU_unit.unit
  have hV_det : IsUnit V.det := hV_unit.map Matrix.detMonoidHom
  have hU_det : IsUnit U.det := hU_unit.map Matrix.detMonoidHom
  let Φ : Matrix (Fin n) (Fin n) ℂ ≃ₗ[ℂ] Matrix (Fin d ⊕ Fin (n - d)) (Fin d ⊕ Fin (n - d)) ℂ :=
    { toFun := fun A => (V * A * U).submatrix e₀.symm e₀.symm
      invFun := fun M => (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) * (M.submatrix e₀ e₀) * ↑U_u⁻¹
      map_add' := fun A B => by
        ext x y
        simp [Matrix.mul_add, Matrix.add_mul]
      map_smul' := fun c A => by
        ext x y
        simp [Matrix.mul_smul, Matrix.smul_mul]
      left_inv := fun A => by
        simp [Matrix.submatrix_submatrix, ← Matrix.mul_assoc,
          show (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) * V = 1 from V_u.inv_mul,
          Matrix.mul_assoc, show U * (↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) = 1 from U_u.mul_inv]
      right_inv := fun M => by
        simp [Matrix.mul_assoc,
          show V * (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) = 1 from V_u.mul_inv,
          show (↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) * U = 1 from U_u.inv_mul,
          Matrix.submatrix_submatrix] }
  let S' : Submodule ℂ (Matrix (Fin d ⊕ Fin (n - d)) (Fin d ⊕ Fin (n - d)) ℂ) :=
    S.map Φ.toLinearMap
  have hΦ_rank : ∀ A : Matrix (Fin n) (Fin n) ℂ, (Φ A).rank = A.rank := by
    intro A
    dsimp only [Φ, LinearEquiv.coe_mk, LinearMap.coe_mk, AddHom.coe_mk]
    rw [Matrix.rank_submatrix, Matrix.rank_mul_eq_left_of_isUnit_det U _ hU_det,
      Matrix.rank_mul_eq_right_of_isUnit_det V _ hV_det]
  have hS'_rank : ∀ M ∈ S', M.rank ≤ d := by
    rintro M ⟨A, hAS, rfl⟩
    rw [hΦ_rank A]
    exact hS_le_d A hAS
  have hI_mem : Matrix.fromBlocks (1 : Matrix (Fin d) (Fin d) ℂ) 0 0 0 ∈ S' := by
    refine ⟨A₀, hA₀S, ?_⟩
    dsimp only [Φ, LinearEquiv.coe_mk, LinearMap.coe_mk, AddHom.coe_mk]
    ext x y
    have hVU' := congr_fun (congr_fun hVU (e₀.symm x)) (e₀.symm y)
    simp only [Matrix.submatrix_apply] at hVU' ⊢
    rw [hVU']
    rcases hx : e_raw (e₀.symm x) with a | i <;> rcases hy : e_raw (e₀.symm y) with b | j
    · have hxa : x = Sum.inl (finCongr hA₀_rank a) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hx
        simpa [e₀] using this.symm
      have hyb : y = Sum.inl (finCongr hA₀_rank b) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hy
        simpa [e₀] using this.symm
      rw [hxa, hyb]
      simp [Matrix.fromBlocks, Fin.ext_iff]
    · have hxa : x = Sum.inl (finCongr hA₀_rank a) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hx
        simpa [e₀] using this.symm
      have hyj : y = Sum.inr (finCongr (by simp [hA₀_rank]) j) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hy
        simpa [e₀] using this.symm
      rw [hxa, hyj]
      simp [Matrix.fromBlocks]
    · have hxi : x = Sum.inr (finCongr (by simp [hA₀_rank]) i) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hx
        simpa [e₀] using this.symm
      have hyb : y = Sum.inl (finCongr hA₀_rank b) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hy
        simpa [e₀] using this.symm
      rw [hxi, hyb]
      simp [Matrix.fromBlocks]
    · have hxi : x = Sum.inr (finCongr (by simp [hA₀_rank]) i) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hx
        simpa [e₀] using this.symm
      have hyj : y = Sum.inr (finCongr (by simp [hA₀_rank]) j) := by
        have := congrArg (Equiv.sumCongr (finCongr hA₀_rank) (finCongr (by simp [hA₀_rank]))) hy
        simpa [e₀] using this.symm
      rw [hxi, hyj]
      simp [Matrix.fromBlocks]
  have h22 : ∀ M ∈ S', M.toBlocks₂₂ = 0 := by
    intro M hM
    refine block₂₂_eq_zero M fun t => hS'_rank _ (S'.add_mem hM (S'.smul_mem t hI_mem))
  have h0 : ∀ M ∈ S', M.toBlocks₂₁ * M.toBlocks₁₂ = 0 := by
    intro M hM
    have := block₂₁_mul_pow_mul_block₁₂_eq_zero M (h22 M hM)
      (fun t => hS'_rank _ (S'.add_mem hI_mem (S'.smul_mem t hM))) 0
    simpa using this
  have h1 : ∀ M ∈ S', M.toBlocks₂₁ * M.toBlocks₁₁ * M.toBlocks₁₂ = 0 := by
    intro M hM
    have := block₂₁_mul_pow_mul_block₁₂_eq_zero M (h22 M hM)
      (fun t => hS'_rank _ (S'.add_mem hI_mem (S'.smul_mem t hM))) 1
    simpa using this
  obtain ⟨hS'_le, hS'_eq_dich⟩ := offdiag_analysis S' h22 h0 h1
  have hfin_eq : Module.finrank ℂ S = Module.finrank ℂ S' := (LinearEquiv.finrank_map_eq Φ S).symm
  have hd_add : d + (n - d) = n := Nat.add_sub_of_le (le_trans hd_le_r hr)
  have hS_le_nd : Module.finrank ℂ S ≤ n * d := by
    rw [hfin_eq, mul_comm n d]
    simpa [hd_add] using hS'_le
  refine ⟨le_trans hS_le_nd (Nat.mul_le_mul_left n hd_le_r), fun hS_eq_nr => ?_⟩
  have hdr : d = r := by
    have hn_pos : 0 < n := lt_of_lt_of_le hd_pos (le_trans hd_le_r hr)
    have hnd_eq : n * d = n * r := by
      have : n * r ≤ n * d := by omega
      exact le_antisymm (Nat.mul_le_mul_left n hd_le_r) this
    exact mul_left_cancel₀ hn_pos.ne' hnd_eq
  have hS'_eq : Module.finrank ℂ S' = d * (d + (n - d)) := by
    rw [← hfin_eq, hS_eq_nr, hd_add, ← hdr, mul_comm n d]
  let eV : (Fin n → ℂ) ≃ₗ[ℂ] (Fin d ⊕ Fin (n - d) → ℂ) :=
    { toFun := fun v => (V *ᵥ v) ∘ e₀.symm
      invFun := fun w => (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (w ∘ e₀)
      map_add' := fun v₁ v₂ => by ext x; simp [Matrix.mulVec_add]
      map_smul' := fun c v => by ext x; simp [Matrix.mulVec_smul]
      left_inv := fun v => by
        ext i
        change ((↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ ((V *ᵥ v) ∘ e₀.symm ∘ e₀)) i = v i
        have hcomp : ((V *ᵥ v) ∘ e₀.symm ∘ e₀) = V *ᵥ v := by ext k; simp
        rw [hcomp, Matrix.mulVec_mulVec,
          show (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) * V = 1 from V_u.inv_mul, Matrix.one_mulVec]
      right_inv := fun w => by
        ext x
        change (V *ᵥ ((↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (w ∘ e₀))) (e₀.symm x) = w x
        rw [Matrix.mulVec_mulVec,
          show V * (↑V_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) = 1 from V_u.mul_inv, Matrix.one_mulVec]
        simp }
  let eU : (Fin d ⊕ Fin (n - d) → ℂ) ≃ₗ[ℂ] (Fin n → ℂ) :=
    { toFun := fun w => U *ᵥ (w ∘ e₀.symm)
      invFun := fun v => ((↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ v) ∘ e₀
      map_add' := fun w₁ w₂ => by
        ext i
        have : (w₁ + w₂) ∘ e₀.symm = w₁ ∘ e₀.symm + w₂ ∘ e₀.symm := rfl
        rw [this, Matrix.mulVec_add]
        rfl
      map_smul' := fun c w => by
        ext i
        have : (c • w) ∘ e₀.symm = c • (w ∘ e₀.symm) := rfl
        rw [this, Matrix.mulVec_smul]
        rfl
      left_inv := fun w => by
        ext x
        change ((↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ (U *ᵥ (w ∘ e₀.symm))) (e₀ x) = w x
        rw [Matrix.mulVec_mulVec,
          show (↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) * U = 1 from U_u.inv_mul, Matrix.one_mulVec]
        simp
      right_inv := fun v => by
        ext i
        change (U *ᵥ (((↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ v) ∘ e₀ ∘ e₀.symm)) i = v i
        have hcomp : ((↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ v) ∘ e₀ ∘ e₀.symm =
            (↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) *ᵥ v := by ext k; simp
        rw [hcomp, Matrix.mulVec_mulVec,
          show U * (↑U_u⁻¹ : Matrix (Fin n) (Fin n) ℂ) = 1 from U_u.mul_inv, Matrix.one_mulVec] }
  have hΦ_mulVec : ∀ (A : Matrix (Fin n) (Fin n) ℂ) (w : Fin d ⊕ Fin (n - d) → ℂ),
      (Φ A).mulVec w = eV (A.mulVec (eU w)) := by
    intro A w
    ext x
    change ∑ y, (V * A * U) (e₀.symm x) (e₀.symm y) * w y =
      (V *ᵥ (A *ᵥ (U *ᵥ (w ∘ e₀.symm)))) (e₀.symm x)
    rw [Matrix.mulVec_mulVec, Matrix.mulVec_mulVec]
    change ∑ y, (V * A * U) (e₀.symm x) (e₀.symm y) * w y =
      ∑ j, (V * A * U) (e₀.symm x) j * w (e₀.symm j)
    exact (e₀.symm.sum_comp (fun j => (V * A * U) (e₀.symm x) j * w (e₀.symm j))).symm
  rcases hS'_eq_dich hS'_eq with hleft | hright
  · left
    let U' : Submodule ℂ (Fin d ⊕ Fin (n - d) → ℂ) :=
      { carrier := {w | ∀ i : Fin (n - d), w (Sum.inr i) = 0}
        add_mem' := fun {w₁ w₂} hw₁ hw₂ i => by simp [hw₁ i, hw₂ i]
        zero_mem' := fun _ => rfl
        smul_mem' := fun c {w} hw i => by simp [hw i] }
    let eU' : U' ≃ₗ[ℂ] (Fin d → ℂ) :=
      { toFun := fun w a => w.1 (Sum.inl a)
        invFun := fun f => ⟨Sum.elim f 0, fun _ => rfl⟩
        map_add' := fun _ _ => rfl
        map_smul' := fun _ _ => rfl
        left_inv := fun w => by ext (a | i); rfl; exact (w.2 i).symm
        right_inv := fun _ => rfl }
    have hU'_dim : Module.finrank ℂ U' = r := by
      rw [LinearEquiv.finrank_eq eU', Module.finrank_fin_fun, hdr]
    refine ⟨U'.map eV.symm.toLinearMap, by rw [LinearEquiv.finrank_map_eq, hU'_dim], ?_⟩
    rintro A hA _ ⟨v, rfl⟩
    refine ⟨(Φ A).mulVec (eU.symm v), ?_, ?_⟩
    · intro i
      have h21 : (Φ A).toBlocks₂₁ = 0 := hleft (Φ A) ⟨A, hA, rfl⟩
      have h22A : (Φ A).toBlocks₂₂ = 0 := h22 (Φ A) ⟨A, hA, rfl⟩
      change (∑ y, Φ A (Sum.inr i) y * (eU.symm v) y) = 0
      rw [Fintype.sum_sum_type]
      have h1_sum : ∑ a : Fin d, Φ A (Sum.inr i) (Sum.inl a) * (eU.symm v) (Sum.inl a) = 0 := by
        refine Finset.sum_eq_zero fun a _ => ?_
        have hzero := congr_fun (congr_fun h21 i) a
        change Φ A (Sum.inr i) (Sum.inl a) = 0 at hzero
        rw [hzero, zero_mul]
      have h2_sum : ∑ j : Fin (n - d), Φ A (Sum.inr i) (Sum.inr j) * (eU.symm v) (Sum.inr j) = 0 := by
        refine Finset.sum_eq_zero fun j _ => ?_
        have hzero := congr_fun (congr_fun h22A i) j
        change Φ A (Sum.inr i) (Sum.inr j) = 0 at hzero
        rw [hzero, zero_mul]
      rw [h1_sum, h2_sum, add_zero]
    · change eV.symm ((Φ A).mulVec (eU.symm v)) = A.mulVec v
      rw [hΦ_mulVec A (eU.symm v)]
      simp
  · right
    let W' : Submodule ℂ (Fin d ⊕ Fin (n - d) → ℂ) :=
      { carrier := {w | ∀ a : Fin d, w (Sum.inl a) = 0}
        add_mem' := fun {w₁ w₂} hw₁ hw₂ a => by simp [hw₁ a, hw₂ a]
        zero_mem' := fun _ => rfl
        smul_mem' := fun c {w} hw a => by simp [hw a] }
    let eW' : W' ≃ₗ[ℂ] (Fin (n - d) → ℂ) :=
      { toFun := fun w i => w.1 (Sum.inr i)
        invFun := fun g => ⟨Sum.elim 0 g, fun _ => rfl⟩
        map_add' := fun _ _ => rfl
        map_smul' := fun _ _ => rfl
        left_inv := fun w => by ext (a | i); exact (w.2 a).symm; rfl
        right_inv := fun _ => rfl }
    have hW'_dim : Module.finrank ℂ W' = n - r := by
      rw [LinearEquiv.finrank_eq eW', Module.finrank_fin_fun, hdr]
    refine ⟨W'.map eU.toLinearMap, by rw [LinearEquiv.finrank_map_eq, hW'_dim], ?_⟩
    rintro A hA _ ⟨w, hw, rfl⟩
    rw [LinearMap.mem_ker]
    change A.mulVec (eU w) = 0
    apply eV.injective
    rw [map_zero, ← hΦ_mulVec A w]
    ext x
    change (∑ y, Φ A x y * w y) = 0
    rw [Fintype.sum_sum_type]
    have hw_inl : ∑ a : Fin d, Φ A x (Sum.inl a) * w (Sum.inl a) = 0 := by
      refine Finset.sum_eq_zero fun a _ => ?_
      rw [hw a, mul_zero]
    have h12 : (Φ A).toBlocks₁₂ = 0 := hright (Φ A) ⟨A, hA, rfl⟩
    have h22A : (Φ A).toBlocks₂₂ = 0 := h22 (Φ A) ⟨A, hA, rfl⟩
    have hw_inr : ∑ j : Fin (n - d), Φ A x (Sum.inr j) * w (Sum.inr j) = 0 := by
      refine Finset.sum_eq_zero fun j _ => ?_
      rcases x with a | i
      · have hzero := congr_fun (congr_fun h12 a) j
        change Φ A (Sum.inl a) (Sum.inr j) = 0 at hzero
        rw [hzero, zero_mul]
      · have hzero := congr_fun (congr_fun h22A i) j
        change Φ A (Sum.inr i) (Sum.inr j) = 0 at hzero
        rw [hzero, zero_mul]
    rw [hw_inl, hw_inr, add_zero]
