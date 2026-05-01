"""Initial schema

Revision ID: 2ff02cf4e26c
Revises: 
Create Date: 2026-04-06 15:24:44.462682

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2ff02cf4e26c'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('produtos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nome', sa.String(length=120), nullable=False),
    sa.Column('categoria', sa.Enum('fruta', 'legume', 'verdura', name='categoria_produto_enum', native_enum=False), nullable=False),
    sa.Column('unidade_medida', sa.Enum('kg', 'un', 'cx', name='unidade_medida_enum', native_enum=False), nullable=False),
    sa.Column('estoque_minimo', sa.Numeric(precision=10, scale=3), server_default='0', nullable=False),
    sa.Column('quantidade_atual', sa.Numeric(precision=10, scale=3), server_default='0', nullable=False),
    sa.Column('ativo', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('nome', 'categoria', name='uq_produtos_nome_categoria')
    )
    op.create_table('usuarios',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nome', sa.String(length=120), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('senha_hash', sa.String(length=255), nullable=False),
    sa.Column('perfil', sa.Enum('funcionario', 'gerente', name='perfil_usuario_enum', native_enum=False), server_default='funcionario', nullable=False),
    sa.Column('ativo', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('movimentacoes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('produto_id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.Enum('entrada', 'saida', name='tipo_movimentacao_enum', native_enum=False), nullable=False),
    sa.Column('subtipo', sa.Enum('compra', 'venda', 'perda', name='subtipo_movimentacao_enum', native_enum=False), nullable=True),
    sa.Column('quantidade', sa.Numeric(precision=10, scale=3), nullable=False),
    sa.Column('data', sa.Date(), nullable=False),
    sa.Column('observacao', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.CheckConstraint('quantidade > 0', name='ck_movimentacoes_quantidade_positiva'),
    sa.ForeignKeyConstraint(['produto_id'], ['produtos.id'], ),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('movimentacoes')
    op.drop_table('usuarios')
    op.drop_table('produtos')
