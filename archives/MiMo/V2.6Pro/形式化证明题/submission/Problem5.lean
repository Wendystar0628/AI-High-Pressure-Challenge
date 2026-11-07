theorem problem5 (f : ℂ → ℂ)
    (hf : DifferentiableOn ℂ f (Metric.ball 0 1))
    (hm : Set.MapsTo f (Metric.ball 0 1) (Metric.ball 0 1))
    (hfix : ∀ z ∈ Metric.ball (0 : ℂ) 1, f z ≠ z) :
    ∃ w : ℂ, ‖w‖ = 1 ∧
      TendstoLocallyUniformlyOn (fun n : ℕ => f^[n]) (fun _ => w)
        Filter.atTop (Metric.ball 0 1) := by
  sorry
