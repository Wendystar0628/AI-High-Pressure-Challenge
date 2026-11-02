import Mathlib.Data.Nat.Squarefree
import Mathlib.Algebra.BigOperators.Ring.Finset
import Mathlib.FieldTheory.Finite.Basic
import Mathlib.RingTheory.RootsOfUnity.PrimitiveRoots
import Mathlib.LinearAlgebra.LinearIndependent.Basic
import Mathlib.Algebra.MonoidAlgebra.Basic
import Mathlib.Tactic.Positivity
import Mathlib.Tactic.LinearCombination
import Mathlib.Tactic.Abel
import Mathlib.Tactic.NormNum

open Finset

private theorem divisor_sum_prod {A : Type*} [CommSemiring A]
    (f : ℕ →* A) {n : ℕ} (hs : Squarefree n) :
    (∑ d ∈ n.divisors, f d) = ∏ q ∈ n.primeFactors, (1 + f q) := by
  rw [← Nat.divisors_filter_squarefree_of_squarefree hs,
    Nat.sum_divisors_filter_squarefree hs.ne_zero, Nat.factors_eq]
  rw [Finset.prod_one_add]
  apply Finset.sum_congr
  · rfl
  · intro t ht
    simp [Finset.prod_val]

private def rootChar (r : ℕ) (K : Type*) [CommRing K] (a : ZMod r) :
    rootsOfUnity r K →* K :=
  ((Units.coeHom K).comp (rootsOfUnity r K).subtype) ^ a.val

private theorem rootChar_apply {r : ℕ} [NeZero r] {K : Type*} [CommRing K]
    (d : ℕ) (x : rootsOfUnity r K) : rootChar r K (d : ZMod r) x = (x : Kˣ).val ^ d := by
  change (x : Kˣ).val ^ (d : ZMod r).val = _
  rw [ZMod.val_natCast]
  exact (pow_eq_pow_mod d ((mem_rootsOfUnity' r _).mp x.prop)).symm

private theorem rootChar_injective {r : ℕ} [NeZero r] {K : Type*} [CommRing K]
    {ζ : K} (hζ : IsPrimitiveRoot ζ r) : Function.Injective (rootChar r K) := by
  intro a b hab
  have he := DFunLike.congr_fun hab (rootsOfUnity.mkOfPowEq ζ hζ.pow_eq_one)
  change ζ ^ a.val = ζ ^ b.val at he
  exact ZMod.val_injective r (hζ.pow_inj (ZMod.val_lt a) (ZMod.val_lt b) he)

private theorem algebra_relation {r p n : ℕ} [NeZero r] [Fact p.Prime]
    {ζ : ZMod p} (hζ : IsPrimitiveRoot ζ r)
    (ha : ∀ x : ZMod p, (∑ d ∈ n.divisors, x ^ d) = (n.divisors.card : ZMod p) * x) :
    (∑ d ∈ n.divisors, MonoidAlgebra.single (d : ZMod r) (1 : ZMod p)) =
      (n.divisors.card : ZMod p) • (1 : MonoidAlgebra (ZMod p) (ZMod r)) := by
  have hli : LinearIndependent (ZMod p) (fun a : ZMod r => ⇑(rootChar r (ZMod p) a)) :=
    (linearIndependent_monoidHom (rootsOfUnity r (ZMod p)) (ZMod p)).comp _
      (rootChar_injective hζ)
  apply MonoidAlgebra.coeff_injective
  apply hli.finsuppLinearCombination_injective
  ext x
  simp only [MonoidAlgebra.coeff_sum, MonoidAlgebra.coeff_single,
    map_sum, Finsupp.linearCombination_single, one_smul,
    MonoidAlgebra.coeff_smul, map_smul, MonoidAlgebra.one_def]
  have hc1 : rootChar r (ZMod p) 1 x = (x : (ZMod p)ˣ).val := by
    simpa using rootChar_apply (r := r) (K := ZMod p) 1 x
  simpa only [Finset.sum_apply, rootChar_apply, Pi.smul_apply, smul_eq_mul, hc1] using
    ha (x : (ZMod p)ˣ).val
private theorem not_unit_one_add_single {K M : Type*} [Field K] [CommMonoid M]
    (a : M) (he : Even (orderOf a)) (hpos : 0 < orderOf a) :
    ¬ IsUnit (1 + MonoidAlgebra.single a (1 : K)) := by
  classical
  intro hu
  let u : MonoidAlgebra K M := MonoidAlgebra.single a 1
  let b : MonoidAlgebra K M := ∑ i ∈ range (orderOf a), (-u) ^ i
  have hz : (1 + u) * b = 0 := by
    have hg := mul_geom_sum (-u) (orderOf a)
    have hp : (-u) ^ orderOf a = 1 := by
      rw [he.neg_pow]
      simp [u, MonoidAlgebra.single_pow, pow_orderOf_eq_one, MonoidAlgebra.one_def]
    rw [hp, sub_self] at hg
    have hn : -u - 1 = -(1 + u) := by abel
    rw [hn, neg_mul, neg_eq_zero] at hg
    exact hg
  have hb : b = 0 := hu.mul_left_cancel (by simpa using hz)
  have hc : b.coeff 1 = 1 := by
    dsimp [b]
    simp only [MonoidAlgebra.coeff_sum, Finsupp.finsetSum_apply]
    rw [Finset.sum_eq_single 0]
    · simp [MonoidAlgebra.one_def]
    · intro i hi hi0
      have hne : a ^ i ≠ 1 := pow_ne_one_of_lt_orderOf hi0 (mem_range.mp hi)
      rw [show -u = MonoidAlgebra.single a (-1 : K) by simp [u],
        MonoidAlgebra.single_pow]
      simp [hne]
    · simp [hpos]
  rw [hb] at hc
  simp at hc

private theorem unit_single_forces_one {K : Type*} [Field K] {r t : ℕ}
    [Fact r.Prime] (hrt : r - 1 = 2 ^ t) {a : ZMod r}
    (ha : a ≠ 0) (hu : IsUnit (1 + MonoidAlgebra.single a (1 : K))) : a = 1 := by
  have hd : orderOf a ∣ 2 ^ t := hrt ▸ ZMod.orderOf_dvd_card_sub_one ha
  obtain ⟨j, hj, hjorder⟩ := (Nat.dvd_prime_pow Nat.prime_two).mp hd
  by_cases hj0 : j = 0
  · have ho : orderOf a = 1 := by simpa [hj0] using hjorder
    exact orderOf_eq_one_iff.mp ho
  · have he : Even (orderOf a) := by
      rw [hjorder]
      exact even_two.pow_of_ne_zero hj0
    exact False.elim (not_unit_one_add_single a he (by rw [hjorder]; positivity) hu)
private def nonzeroHom (K : Type*) [Field K] (r : ℕ) [Fact r.Prime] : ZMod r →* K where
  toFun a := if a = 0 then 0 else 1
  map_one' := by simp
  map_mul' a b := by
    by_cases ha : a = 0 <;> by_cases hb : b = 0 <;> simp [ha, hb]

private theorem no_zero_prime {K : Type*} [Field K] (h2 : (2 : K) ≠ 0)
    {r : ℕ} [Fact r.Prime] (s : Finset ℕ) (hs : ∀ q ∈ s, q.Prime)
    (hrel : (∏ q ∈ s, (1 + MonoidAlgebra.single (q : ZMod r) (1 : K))) =
      (2 : K) ^ s.card • (1 : MonoidAlgebra K (ZMod r))) :
    ∀ q ∈ s, (q : ZMod r) ≠ 0 := by
  classical
  intro q hq hqzero
  have hqr : r = q := (Nat.prime_dvd_prime_iff_eq (Fact.out : r.Prime) (hs q hq)).mp
    ((ZMod.natCast_eq_zero_iff q r).mp hqzero)
  have hother : ∀ j ∈ s.erase q, (j : ZMod r) ≠ 0 := by
    intro j hj hz
    have hrj : r = j := (Nat.prime_dvd_prime_iff_eq (Fact.out : r.Prime)
      (hs j (mem_of_mem_erase hj))).mp ((ZMod.natCast_eq_zero_iff j r).mp hz)
    exact (ne_of_mem_erase hj) (hrj.symm.trans hqr)
  let L : MonoidAlgebra K (ZMod r) →ₐ[K] K :=
    MonoidAlgebra.lift K K (ZMod r) (nonzeroHom K r)
  have hh := congrArg L hrel
  simp only [L, map_prod, map_add, map_one, MonoidAlgebra.lift_single,
    map_smul, smul_eq_mul, mul_one, one_mul] at hh
  have hfq : (1 : K) + nonzeroHom K r (q : ZMod r) = 1 := by
    simp [nonzeroHom, hqzero]
  have hrest : (∏ j ∈ s.erase q, (1 + nonzeroHom K r (j : ZMod r))) =
      (2 : K) ^ (s.erase q).card := by
    calc
      _ = ∏ _j ∈ s.erase q, (2 : K) := by
        apply prod_congr rfl
        intro j hj
        simp [nonzeroHom, hother j hj, one_add_one_eq_two]
      _ = _ := by simp
  change (∏ q ∈ s, (1 + nonzeroHom K r (q : ZMod r))) = (2 : K) ^ s.card at hh
  rw [← mul_prod_erase s _ hq, hfq, one_mul, hrest,
    ← card_erase_add_one hq, pow_succ] at hh
  have hz : (2 : K) ^ (s.erase q).card = 0 := by linear_combination -hh
  exact pow_ne_zero _ h2 hz

private theorem prime_residues {K : Type*} [Field K] (h2 : (2 : K) ≠ 0)
    {r t : ℕ} [Fact r.Prime] (hrt : r - 1 = 2 ^ t)
    (s : Finset ℕ) (hs : ∀ q ∈ s, q.Prime)
    (hrel : (∏ q ∈ s, (1 + MonoidAlgebra.single (q : ZMod r) (1 : K))) =
      (2 : K) ^ s.card • (1 : MonoidAlgebra K (ZMod r))) :
    ∀ q ∈ s, (q : ZMod r) = 1 := by
  intro q hq
  apply unit_single_forces_one (K := K) hrt (no_zero_prime h2 s hs hrel q hq)
  apply (IsUnit.prod_iff.mp (show IsUnit (∏ q ∈ s,
    (1 + MonoidAlgebra.single (q : ZMod r) (1 : K))) from ?_)) q hq
  rw [hrel, Algebra.smul_def, mul_one]
  exact (isUnit_iff_ne_zero.mpr (pow_ne_zero _ h2)).map (algebraMap K _)
theorem problem7 (n p r m : ℕ) (hn : 0 < n) (hs : Squarefree n)
    (hr : r.Prime) (hf : r = 2 ^ (2 ^ m) + 1)
    (hp : p.Prime) (hpn : p ∣ n) (hpr : Nat.ModEq r p 1)
    (ha : ∀ x : ℤ, (n : ℤ) ∣ (∑ d ∈ n.divisors, x ^ d) - (n.divisors.card : ℤ) * x) :
    ∀ d ∈ n.divisors, Nat.ModEq r d 1 := by
  classical
  haveI : Fact p.Prime := ⟨hp⟩
  haveI : Fact r.Prime := ⟨hr⟩
  have hprdiv : r ∣ p - 1 := (Nat.modEq_iff_dvd' hp.one_le).mp hpr.symm
  have hp2 : p ≠ 2 := by
    intro he
    have hd : r ∣ 1 := by simpa [he] using hprdiv
    exact hr.ne_one (Nat.dvd_one.mp hd)
  have h2 : (2 : ZMod p) ≠ 0 := by
    intro hz
    exact hp2 ((Nat.prime_dvd_prime_iff_eq hp Nat.prime_two).mp
      ((ZMod.natCast_eq_zero_iff 2 p).mp hz))
  have hdvdcard : r ∣ Fintype.card (ZMod p)ˣ := by rwa [ZMod.card_units]
  obtain ⟨ζu, hζu⟩ := exists_prime_orderOf_dvd_card (G := (ZMod p)ˣ) r hdvdcard
  have hζprim : IsPrimitiveRoot (ζu : ZMod p) r :=
    ((IsPrimitiveRoot.iff_orderOf).mpr hζu).map_of_injective
      (f := Units.coeHom (ZMod p)) Units.coeHom_injective
  have hfield (x : ZMod p) :
      (∑ d ∈ n.divisors, x ^ d) = (n.divisors.card : ZMod p) * x := by
    apply sub_eq_zero.mp
    have hpnZ : (p : ℤ) ∣ n := by exact_mod_cast hpn
    have hd := dvd_trans hpnZ (ha (x.val : ℤ))
    have hz := (ZMod.intCast_zmod_eq_zero_iff_dvd
      ((∑ d ∈ n.divisors, (x.val : ℤ) ^ d) - (n.divisors.card : ℤ) * x.val) p).mpr hd
    simpa using hz
  have hcard : n.divisors.card = 2 ^ n.primeFactors.card := by
    simpa using divisor_sum_prod (1 : ℕ →* ℕ) hs
  let f : ℕ →* MonoidAlgebra (ZMod p) (ZMod r) :=
    (MonoidAlgebra.of (ZMod p) (ZMod r)).comp (Nat.castRingHom (ZMod r)).toMonoidHom
  have hprod : (∏ q ∈ n.primeFactors,
      (1 + MonoidAlgebra.single (q : ZMod r) (1 : ZMod p))) =
      (2 : ZMod p) ^ n.primeFactors.card •
        (1 : MonoidAlgebra (ZMod p) (ZMod r)) := by
    calc
      _ = ∑ d ∈ n.divisors, f d := (divisor_sum_prod f hs).symm
      _ = _ := by
        change (∑ d ∈ n.divisors, MonoidAlgebra.single (d : ZMod r) (1 : ZMod p)) = _
        simpa only [hcard, Nat.cast_pow, Nat.cast_ofNat] using algebra_relation hζprim hfield
  have hres : ∀ q ∈ n.primeFactors, (q : ZMod r) = 1 := by
    apply prime_residues h2 (show r - 1 = 2 ^ (2 ^ m) by rw [hf, Nat.add_sub_cancel]) n.primeFactors
      (fun q hq => Nat.prime_of_mem_primeFactors hq) hprod
  intro d hd
  have hdn : d ∣ n := Nat.dvd_of_mem_divisors hd
  have hsd : Squarefree d := hs.squarefree_of_dvd hdn
  apply (ZMod.natCast_eq_natCast_iff d 1 r).mp
  rw [Nat.cast_one, ← Nat.prod_primeFactors_of_squarefree hsd, Nat.cast_prod]
  apply Finset.prod_eq_one
  intro q hq
  apply hres
  exact Nat.mem_primeFactors.mpr ⟨Nat.prime_of_mem_primeFactors hq,
    dvd_trans (Nat.dvd_of_mem_primeFactors hq) hdn, hn.ne'⟩

#print axioms problem5