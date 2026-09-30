import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  DESCRIPTION_MAX_LENGTH,
  itemKeys,
  lengthOf,
  NAME_MAX_LENGTH,
  serverFieldErrors,
  toRequest,
  validateItem,
  valuesOf,
  type Item,
  type ItemFormValues,
} from "@/entities/item";
import { ApiError, createItem, REPORTED_INLINE, updateItem } from "@/shared/api";
import { ApiErrorBanner } from "@/shared/ui";

interface ItemDialogProps {
  /** The item to edit; absent to create one. */
  item?: Item;
  onClose: () => void;
}

/**
 * Create or edit one item.
 *
 * The limits are checked on submit and then live, so a user is not told off
 * for a field they have not finished. The server remains the authority: a
 * refusal it returns is shown in a banner, and any field error it names is
 * also put beside that field. On success the item list is invalidated and
 * re-read — nothing is written into the cache optimistically.
 *
 * The caller mounts it to open it and unmounts it to close it, so each opening
 * starts from the item it was opened for. Seeding the form once, at mount, is
 * also what keeps a background refetch of the list from overwriting what the
 * user is typing.
 */
export function ItemDialog({ item, onClose }: ItemDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const editing = item !== undefined;

  const [values, setValues] = useState<ItemFormValues>(() => valuesOf(item));
  const [submitted, setSubmitted] = useState(false);

  const saveMutation = useMutation({
    meta: REPORTED_INLINE,
    mutationFn: (form: ItemFormValues) =>
      editing ? updateItem(item.id, toRequest(form)) : createItem(toRequest(form)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: itemKeys.all });
      onClose();
    },
  });

  const errors = submitted ? validateItem(values) : {};
  const server =
    saveMutation.error instanceof ApiError ? serverFieldErrors(saveMutation.error.fieldErrors) : {};

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const found = validateItem(values);
    if (found.name) {
      nameRef.current?.focus();
      return;
    }
    if (found.description) {
      descriptionRef.current?.focus();
      return;
    }
    saveMutation.mutate(values);
  }

  const nameError = errors.name ? t(errors.name, { max: NAME_MAX_LENGTH }) : server.name;
  const descriptionError = errors.description
    ? t(errors.description, { max: DESCRIPTION_MAX_LENGTH })
    : server.description;
  const pending = saveMutation.isPending;

  return (
    <Dialog
      open
      onClose={pending ? undefined : onClose}
      aria-labelledby={titleId}
      maxWidth="sm"
      fullWidth
    >
      <Box component="form" noValidate onSubmit={handleSubmit}>
        <DialogTitle id={titleId}>
          {editing ? t("items.form.editTitle") : t("items.form.createTitle")}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            {saveMutation.isError ? <ApiErrorBanner error={saveMutation.error} /> : null}
            <TextField
              inputRef={nameRef}
              label={t("items.fields.name")}
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
              // The dialog opened to fill this form, so focus belongs on its
              // first field; a modal must place focus inside itself anyway.
              // eslint-disable-next-line jsx-a11y/no-autofocus -- see above
              autoFocus
              fullWidth
              error={Boolean(nameError)}
              helperText={
                nameError ??
                t("items.form.counter", {
                  length: lengthOf(values.name.trim()),
                  max: NAME_MAX_LENGTH,
                })
              }
            />
            <TextField
              inputRef={descriptionRef}
              label={t("items.fields.description")}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              multiline
              minRows={3}
              fullWidth
              error={Boolean(descriptionError)}
              helperText={
                descriptionError ??
                t("items.form.counter", {
                  length: lengthOf(values.description.trim()),
                  max: DESCRIPTION_MAX_LENGTH,
                })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {editing ? t("common.save") : t("common.create")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
