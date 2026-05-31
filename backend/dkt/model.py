
from __future__ import annotations

import torch
import torch.nn as nn

class AKT(nn.Module):
    def __init__(
        self,
        n_concepts:  int,
        d_model:     int   = 64,
        n_heads:     int   = 8,
        n_layers:    int   = 2,
        dropout:     float = 0.2,
        max_seq:     int   = 512,
    ):
        super().__init__()
        self.n_concepts = n_concepts
        self.d_model    = d_model

        self.concept_embed = nn.Embedding(n_concepts + 1, d_model, padding_idx=0)
        self.signal_proj   = nn.Sequential(nn.Linear(1, d_model), nn.Tanh())
        self.time_embed    = nn.Linear(1, d_model)
        self.input_proj    = nn.Linear(d_model * 3, d_model)
        self.pos_embed     = nn.Embedding(max_seq, d_model)
        self.drop          = nn.Dropout(dropout)

        layer = nn.TransformerEncoderLayer(
            d_model         = d_model,
            nhead           = n_heads,
            dim_feedforward = d_model * 4,
            dropout         = dropout,
            batch_first     = True,
            norm_first      = True,
        )
        self.transformer  = nn.TransformerEncoder(layer, num_layers=n_layers)
        self.mastery_head = nn.Linear(d_model, n_concepts)

    def _encode(
        self,
        concept_ids:  torch.Tensor,
        signals:      torch.Tensor,
        elapsed_days: torch.Tensor,
    ) -> torch.Tensor:
        T   = concept_ids.shape[1]
        c   = self.concept_embed(concept_ids)
        s   = self.signal_proj(signals.unsqueeze(-1))
        t   = self.time_embed(torch.log1p(elapsed_days).unsqueeze(-1))
        pos = self.pos_embed(torch.arange(T, device=concept_ids.device).unsqueeze(0))
        return self.drop(self.input_proj(torch.cat([c, s, t], dim=-1)) + pos)

    def forward(
        self,
        concept_ids:  torch.Tensor,
        signals:      torch.Tensor,
        elapsed_days: torch.Tensor,
        padding_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        x = self._encode(concept_ids, signals, elapsed_days)
        T = concept_ids.shape[1]
        causal = nn.Transformer.generate_square_subsequent_mask(T, device=concept_ids.device)
        h = self.transformer(x, mask=causal, src_key_padding_mask=padding_mask, is_causal=True)
        return torch.sigmoid(self.mastery_head(h))

    def get_hidden(
        self,
        concept_ids:  torch.Tensor,
        signals:      torch.Tensor,
        elapsed_days: torch.Tensor,
        padding_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        x = self._encode(concept_ids, signals, elapsed_days)
        T = concept_ids.shape[1]
        causal = nn.Transformer.generate_square_subsequent_mask(T, device=concept_ids.device)
        h = self.transformer(x, mask=causal, src_key_padding_mask=padding_mask, is_causal=True)

        if padding_mask is not None:
            valid = ~padding_mask
            out = []
            for i in range(concept_ids.shape[0]):
                pos = valid[i].nonzero(as_tuple=False).squeeze(-1)
                idx = int(pos[-1].item()) if len(pos) > 0 else T - 1
                out.append(h[i, idx])
            return torch.stack(out, dim=0)
        return h[:, -1, :]
