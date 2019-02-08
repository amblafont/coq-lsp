.PHONY: coq_boot build build-all clean opam

COQ_BUILD_CONTEXT=../_build/default/coq

build: coq_boot
	dune build

build-all: coq_boot
	dune build @all

coq_boot:
	dune build $(DUNEOPT) @vodeps
	cd coq && dune exec tools/coq_dune.exe $(COQ_BUILD_CONTEXT)/.vfiles.d

clean:
	dune clean

# We first pin lablgtk3 as to avoid problems with parallel make
opam:
	opam pin add coq-lsp . --kind=path -y
	opam install coq-lsp
