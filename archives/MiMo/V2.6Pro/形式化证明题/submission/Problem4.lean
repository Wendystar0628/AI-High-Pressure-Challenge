theorem problem4 (n r : ℕ) (hr : r ≤ n)
    (S : Submodule ℂ (Matrix (Fin n) (Fin n) ℂ))
    (hS : ∀ A ∈ S, A.rank ≤ r) :
    Module.finrank ℂ S ≤ n * r ∧ (Module.finrank ℂ S = n * r →
      (∃ U : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ U = r ∧
        ∀ A ∈ S, LinearMap.range A.mulVecLin ≤ U) ∨
      (∃ W : Submodule ℂ (Fin n → ℂ), Module.finrank ℂ W = n - r ∧
        ∀ A ∈ S, W ≤ LinearMap.ker A.mulVecLin)) := by
  sorry
