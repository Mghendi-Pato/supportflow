'use client';
import { forwardRef } from 'react';
import MuiSelect, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormHelperText from '@mui/material/FormHelperText';

interface SelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  name?: string;
  /** Pass true when the Select is inside a createPortal modal to prevent the
   *  dropdown from teleporting to document.body at z-index 1300 (which renders
   *  it behind the modal backdrop). With disablePortal the popover renders as a
   *  child of the Select's DOM node, inheriting the modal's stacking context. */
  disablePortal?: boolean;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ label, error, options, placeholder, value, onChange, disabled, id, className, name, disablePortal }, ref) => {
    const labelId = id ? `${id}-label` : label ? `${label.toLowerCase().replace(/\s+/g, '-')}-label` : undefined;

    const handleChange = (e: SelectChangeEvent<string>) => {
      onChange?.({ target: { value: e.target.value } });
    };

    return (
      <FormControl
        ref={ref}
        fullWidth
        size="small"
        error={!!error}
        disabled={disabled}
        className={className}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '0.5rem',
            backgroundColor: 'white',
            fontSize: '0.875rem',
            '& fieldset': { borderColor: error ? '#f87171' : '#d1d5db' },
            '&:hover fieldset': { borderColor: '#6366f1' },
            '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '2px' },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.875rem',
            color: '#374151',
            '&.Mui-focused': { color: '#6366f1' },
          },
        }}
      >
        {/* shrink=true keeps the label floated above — prevents overlap with placeholder/displayEmpty value */}
        {label && <InputLabel id={labelId} shrink>{label}</InputLabel>}
        <MuiSelect
          labelId={labelId}
          id={id}
          name={name}
          value={value ?? ''}
          label={label}
          onChange={handleChange}
          displayEmpty
          MenuProps={{
            disablePortal,
            slotProps: {
              paper: {
                sx: {
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  '& .MuiMenuItem-root': {
                    fontSize: '0.875rem',
                    '&:hover': { backgroundColor: '#eef2ff' },
                    '&.Mui-selected': { backgroundColor: '#e0e7ff', '&:hover': { backgroundColor: '#c7d2fe' } },
                  },
                },
              },
            },
          }}
        >
          {placeholder && (
            <MenuItem value="" disabled>
              <span className="text-gray-400">{placeholder}</span>
            </MenuItem>
          )}
          {options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </MuiSelect>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }
);
Select.displayName = 'Select';
